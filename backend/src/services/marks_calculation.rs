//! Marks calculation for course exam attempts.
use crate::models::exam_workflow::{CourseSubjectMark, SubjectMarkComponents};

pub const PASS_PERCENTAGE: f64 = 40.0;

#[derive(Debug, Clone)]
pub struct ResultTableRow {
    pub subject: String,
    pub max_marks: f64,
    pub obtained: f64,
    pub status: String,
    pub theory_total: f64,
    pub theory_obtained: f64,
    pub practical_total: f64,
    pub practical_obtained: f64,
    pub assignment_total: f64,
    pub assignment_obtained: f64,
}

impl ResultTableRow {
    fn has_component_breakdown(&self) -> bool {
        self.theory_total.abs() > f64::EPSILON
            || self.practical_total.abs() > f64::EPSILON
            || self.assignment_total.abs() > f64::EPSILON
    }

    fn theory_total_value(&self) -> f64 {
        if self.has_component_breakdown() {
            if self.theory_total.abs() > f64::EPSILON {
                self.theory_total
            } else {
                (self.max_marks - self.practical_total - self.assignment_total).max(0.0)
            }
        } else {
            self.max_marks.max(0.0)
        }
    }

    fn theory_obtained_value(&self) -> f64 {
        if self.has_component_breakdown() {
            if self.theory_total.abs() > f64::EPSILON || self.theory_obtained.abs() > f64::EPSILON {
                self.theory_obtained
            } else {
                (self.obtained - self.practical_obtained - self.assignment_obtained).max(0.0)
            }
        } else {
            self.obtained.max(0.0)
        }
    }

    fn total_marks_value(&self) -> f64 {
        if self.has_component_breakdown() {
            self.theory_total_value() + self.practical_total + self.assignment_total
        } else {
            self.max_marks.max(0.0)
        }
    }

    fn total_obtained_value(&self) -> f64 {
        if self.has_component_breakdown() {
            self.theory_obtained_value() + self.practical_obtained + self.assignment_obtained
        } else {
            self.obtained.max(0.0)
        }
    }

    fn status_upper(&self) -> String {
        let status = self.status.trim().to_uppercase();
        if !status.is_empty() {
            status
        } else if self.total_marks_value() > 0.0
            && self.total_obtained_value() + f64::EPSILON
                >= self.total_marks_value() * (PASS_PERCENTAGE / 100.0)
        {
            "PASS".to_string()
        } else {
            "FAIL".to_string()
        }
    }

    fn display_status(&self) -> &'static str {
        if self.status_upper() == "PASS" {
            "Pass"
        } else {
            "Fail"
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct SubjectMarkInput {
    pub exam_obtained: f64,
    pub exam_total: f64,
    pub min_exam_marks: f64,
    pub practical_obtained: f64,
    pub practical_total: f64,
    pub min_practical_marks: f64,
    pub practical_enabled: bool,
    pub assignment_obtained: f64,
    pub assignment_total: f64,
    pub min_assignment_marks: f64,
    pub assignment_enabled: bool,
    pub from_online_exam: bool,
    pub exam_readonly: bool,
}

#[derive(Debug, Clone)]
pub struct OverallResult {
    pub subject_marks: Vec<CourseSubjectMark>,
    pub total_obtained: f64,
    pub total_marks: f64,
    pub percentage: f64,
    pub overall_result: String,
    pub any_subject_failed: bool,
}

pub fn compute_subject_totals(input: &SubjectMarkInput) -> (f64, f64, bool) {
    let obtained = input.exam_obtained + input.practical_obtained + input.assignment_obtained;
    let total = input.exam_total + input.practical_total + input.assignment_total;
    
    // Check each component's min passing marks
    let exam_passed = input.exam_obtained >= input.min_exam_marks;
    let practical_passed = if input.practical_enabled {
        input.practical_obtained >= input.min_practical_marks
    } else {
        true // If not enabled, automatically pass
    };
    let assignment_passed = if input.assignment_enabled {
        input.assignment_obtained >= input.min_assignment_marks
    } else {
        true // If not enabled, automatically pass
    };
    
    let passed = total > 0.0 && exam_passed && practical_passed && assignment_passed;
    (obtained, total, passed)
}

pub fn compute_overall_result(
    subject_id: mongodb::bson::oid::ObjectId,
    input: SubjectMarkInput,
) -> CourseSubjectMark {
    let (obtained, total, subject_passed) = compute_subject_totals(&input);
    CourseSubjectMark {
        subject_id,
        obtained,
        total,
        components: SubjectMarkComponents {
            exam_obtained: input.exam_obtained,
            exam_total: input.exam_total,
            practical_obtained: input.practical_obtained,
            practical_total: input.practical_total,
            assignment_obtained: input.assignment_obtained,
            assignment_total: input.assignment_total,
        },
        from_online_exam: input.from_online_exam,
        exam_readonly: input.exam_readonly,
        subject_passed,
    }
}

pub fn aggregate_overall(subjects: Vec<CourseSubjectMark>) -> OverallResult {
    let total_obtained: f64 = subjects.iter().map(|s| s.obtained).sum();
    let total_marks: f64 = subjects.iter().map(|s| s.total).sum();
    let percentage = if total_marks > 0.0 {
        (total_obtained / total_marks) * 100.0
    } else {
        0.0
    };
    let any_subject_failed = subjects.iter().any(|s| !s.subject_passed && s.total > 0.0);
    let overall_result = if any_subject_failed {
        "fail".to_string()
    } else {
        "pass".to_string()
    };
    OverallResult {
        subject_marks: subjects,
        total_obtained,
        total_marks,
        percentage,
        overall_result,
        any_subject_failed,
    }
}

fn esc_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

pub fn render_result_table_html(rows: &[ResultTableRow]) -> String {
    if rows.is_empty() {
        return r#"<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;border:1px dashed #94a3b8;color:#64748b;font-size:0.85em;">No result data</div>"#
            .to_string();
    }

    let show_practical = rows.iter().any(|row| {
        row.practical_total.abs() > f64::EPSILON || row.practical_obtained.abs() > f64::EPSILON
    });
    let show_assignment = rows.iter().any(|row| {
        row.assignment_total.abs() > f64::EPSILON || row.assignment_obtained.abs() > f64::EPSILON
    });
    let component_count = 1 + usize::from(show_practical) + usize::from(show_assignment);

    let mut table = String::from(
        r#"<div style="width:100%;height:100%;overflow:hidden;display:flex;align-items:stretch;">
<table style="width:100%;height:100%;border-collapse:collapse;table-layout:fixed;font-family:inherit;font-size:inherit;border:1.5px solid #3b82f6;background:#ffffff;">
<thead>
<tr style="background-color:#3b82f6;color:#ffffff;font-weight:700;text-transform:uppercase;font-size:0.82em;">
<th style="border:1px solid #93c5fd;padding:4px;text-align:center;width:6%;">Sr. No.</th>
<th style="border:1px solid #93c5fd;padding:4px;text-align:center;width:30%;">Subject Name</th>
<th colspan="__COMPONENT_COUNT__" style="border:1px solid #93c5fd;padding:4px;text-align:center;">Total Marks</th>
<th colspan="__COMPONENT_COUNT__" style="border:1px solid #93c5fd;padding:4px;text-align:center;">Obtained Marks</th>
<th style="border:1px solid #93c5fd;padding:4px;text-align:center;width:10%;">Total Obtained</th>
<th style="border:1px solid #93c5fd;padding:4px;text-align:center;width:8%;">Status</th>
</tr>
<tr style="background-color:#f8fafc;color:#334155;font-weight:700;text-transform:uppercase;font-size:0.72em;">
<th style="border:1px solid #93c5fd;padding:3px;"></th>
<th style="border:1px solid #93c5fd;padding:3px;"></th>
<th style="border:1px solid #93c5fd;padding:3px;text-align:center;">Theory</th>
__TOTAL_COMPONENT_HEADERS__
<th style="border:1px solid #93c5fd;padding:3px;text-align:center;">Theory</th>
__OBTAINED_COMPONENT_HEADERS__
<th style="border:1px solid #93c5fd;padding:3px;"></th>
<th style="border:1px solid #93c5fd;padding:3px;"></th>
</tr>
</thead>
<tbody>"#,
    );

    table = table.replace("__COMPONENT_COUNT__", &component_count.to_string());
    table = table.replace(
        "__TOTAL_COMPONENT_HEADERS__",
        &format!(
            "{}{}",
            if show_practical {
                r#"<th style="border:1px solid #93c5fd;padding:3px;text-align:center;">Practical</th>"#
            } else {
                ""
            },
            if show_assignment {
                r#"<th style="border:1px solid #93c5fd;padding:3px;text-align:center;">Assignment</th>"#
            } else {
                ""
            }
        ),
    );
    table = table.replace(
        "__OBTAINED_COMPONENT_HEADERS__",
        &format!(
            "{}{}",
            if show_practical {
                r#"<th style="border:1px solid #93c5fd;padding:3px;text-align:center;">Practical</th>"#
            } else {
                ""
            },
            if show_assignment {
                r#"<th style="border:1px solid #93c5fd;padding:3px;text-align:center;">Assignment</th>"#
            } else {
                ""
            }
        ),
    );

    let mut total_theory = 0.0;
    let mut total_practical = 0.0;
    let mut total_assignment = 0.0;
    let mut obtained_theory = 0.0;
    let mut obtained_practical = 0.0;
    let mut obtained_assignment = 0.0;
    let mut grand_total_obtained = 0.0;
    let mut any_subject_failed = false;

    for (index, row) in rows.iter().enumerate() {
        let theory_total = row.theory_total_value();
        let theory_obtained = row.theory_obtained_value();
        let practical_total = row.practical_total.max(0.0);
        let practical_obtained = row.practical_obtained.max(0.0);
        let assignment_total = row.assignment_total.max(0.0);
        let assignment_obtained = row.assignment_obtained.max(0.0);
        let total_obtained = row.total_obtained_value();
        let status_upper = row.status_upper();

        total_theory += theory_total;
        total_practical += practical_total;
        total_assignment += assignment_total;
        obtained_theory += theory_obtained;
        obtained_practical += practical_obtained;
        obtained_assignment += assignment_obtained;
        grand_total_obtained += total_obtained;
        any_subject_failed |= status_upper == "FAIL";

        table.push_str(&format!(
            r#"<tr style="font-weight:700;font-size:0.8em;color:#1f2937;">
<td style="border:1px solid #93c5fd;padding:4px;text-align:center;vertical-align:middle;">{}</td>
<td style="border:1px solid #93c5fd;padding:4px;text-align:center;vertical-align:middle;word-break:break-word;">{}</td>
<td style="border:1px solid #93c5fd;padding:4px;text-align:center;vertical-align:middle;">{:.0}</td>
{}{}<td style="border:1px solid #93c5fd;padding:4px;text-align:center;vertical-align:middle;">{:.0}</td>
{}{}<td style="border:1px solid #93c5fd;padding:4px;text-align:center;vertical-align:middle;">{:.0}</td>
<td style="border:1px solid #93c5fd;padding:4px;text-align:center;vertical-align:middle;color:{};">{}</td>
</tr>"#,
            index + 1,
            esc_html(&row.subject.to_uppercase()),
            theory_total,
            if show_practical {
                format!(
                    r#"<td style="border:1px solid #93c5fd;padding:4px;text-align:center;vertical-align:middle;">{:.0}</td>"#,
                    practical_total
                )
            } else {
                String::new()
            },
            if show_assignment {
                format!(
                    r#"<td style="border:1px solid #93c5fd;padding:4px;text-align:center;vertical-align:middle;">{:.0}</td>"#,
                    assignment_total
                )
            } else {
                String::new()
            },
            theory_obtained,
            if show_practical {
                format!(
                    r#"<td style="border:1px solid #93c5fd;padding:4px;text-align:center;vertical-align:middle;">{:.0}</td>"#,
                    practical_obtained
                )
            } else {
                String::new()
            },
            if show_assignment {
                format!(
                    r#"<td style="border:1px solid #93c5fd;padding:4px;text-align:center;vertical-align:middle;">{:.0}</td>"#,
                    assignment_obtained
                )
            } else {
                String::new()
            },
            total_obtained,
            if status_upper == "PASS" { "#111827" } else { "#dc2626" },
            row.display_status()
        ));
    }

    let grand_total_max = total_theory + total_practical + total_assignment;
    let overall_percentage = if grand_total_max > 0.0 {
        (grand_total_obtained / grand_total_max) * 100.0
    } else {
        0.0
    };
    let overall_status = if any_subject_failed {
        "FAIL"
    } else if overall_percentage >= PASS_PERCENTAGE {
        "PASS"
    } else {
        "FAIL"
    };

    table.push_str(&format!(
        r#"<tr style="background-color:#ffffff;color:#374151;font-weight:700;font-size:0.8em;">
<td style="border:1px solid #93c5fd;padding:4px;text-align:center;"></td>
<td style="border:1px solid #93c5fd;padding:4px;text-align:center;">Total</td>
<td style="border:1px solid #93c5fd;padding:4px;text-align:center;">{:.0}</td>
{}{}<td style="border:1px solid #93c5fd;padding:4px;text-align:center;">{:.0}</td>
{}{}<td style="border:1px solid #93c5fd;padding:4px;text-align:center;">{:.0}</td>
<td style="border:1px solid #93c5fd;padding:4px;text-align:center;">{}</td>
</tr>
<tr style="background-color:#3b82f6;color:#ffffff;font-weight:700;text-transform:uppercase;font-size:0.78em;">
<td colspan="2" style="border:1px solid #93c5fd;padding:5px;text-align:center;">Grand Total Marks</td>
<td colspan="{}" style="border:1px solid #93c5fd;padding:5px;text-align:center;">{:.0}</td>
<td colspan="{}" style="border:1px solid #93c5fd;padding:5px;text-align:center;">Grand Obtained Marks</td>
<td style="border:1px solid #93c5fd;padding:5px;text-align:center;">{:.0}</td>
<td style="border:1px solid #93c5fd;padding:5px;text-align:center;">{}</td>
</tr>
<tr style="background-color:#3b82f6;color:#ffffff;font-weight:700;text-transform:uppercase;font-size:0.78em;">
<td colspan="2" style="border:1px solid #93c5fd;padding:5px;text-align:center;">Percentage</td>
<td colspan="{}" style="border:1px solid #93c5fd;padding:5px;text-align:center;">{:.1}%</td>
<td colspan="{}" style="border:1px solid #93c5fd;padding:5px;text-align:center;">Result</td>
<td colspan="2" style="border:1px solid #93c5fd;padding:5px;text-align:center;">{}</td>
</tr>
</tbody>
</table>
</div>"#,
        total_theory,
        if show_practical {
            format!(
                r#"<td style="border:1px solid #93c5fd;padding:4px;text-align:center;">{:.0}</td>"#,
                total_practical
            )
        } else {
            String::new()
        },
        if show_assignment {
            format!(
                r#"<td style="border:1px solid #93c5fd;padding:4px;text-align:center;">{:.0}</td>"#,
                total_assignment
            )
        } else {
            String::new()
        },
        obtained_theory,
        if show_practical {
            format!(
                r#"<td style="border:1px solid #93c5fd;padding:4px;text-align:center;">{:.0}</td>"#,
                obtained_practical
            )
        } else {
            String::new()
        },
        if show_assignment {
            format!(
                r#"<td style="border:1px solid #93c5fd;padding:4px;text-align:center;">{:.0}</td>"#,
                obtained_assignment
            )
        } else {
            String::new()
        },
        grand_total_obtained,
        if overall_status == "PASS" { "Pass" } else { "Fail" },
        component_count,
        grand_total_max,
        component_count,
        grand_total_obtained,
        overall_status,
        component_count,
        overall_percentage,
        component_count,
        overall_status
    ));

    table
}
