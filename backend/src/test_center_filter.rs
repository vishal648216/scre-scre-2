
use mongodb::bson::oid::ObjectId;

fn flatten_center_id_strings(ids: Option<Vec<String>>) -> Vec<String> {
    println!("DEBUG: flatten_center_id_strings: input ids: {:?}", ids);
    let mut out = Vec::new();
    if let Some(list) = ids {
        for id in list {
            println!(
                "DEBUG: flatten_center_id_strings: processing id string: {:?}",
                id
            );
            for part in id.split(',') {
                let trimmed = part.trim();
                if !trimmed.is_empty() {
                    out.push(trimmed.to_string());
                }
            }
        }
    }
    println!("DEBUG: flatten_center_id_strings: output: {:?}", out);
    out
}

fn parse_center_id_filter(ids: Option<Vec<String>>) -> Option<Vec<ObjectId>> {
    println!("DEBUG: parse_center_id_filter: input ids: {:?}", ids);
    let parsed: Vec<ObjectId> = flatten_center_id_strings(ids)
        .iter()
        .filter_map(|id| {
            let res = ObjectId::parse_str(id);
            println!("DEBUG: parse_center_id_filter: parsing id {:?}: {:?}", id, res);
            res.ok()
        })
        .collect();
    println!("DEBUG: parse_center_id_filter: output: {:?}", parsed);
    if parsed.is_empty() {
        None
    } else {
        Some(parsed)
    }
}

fn main() {
    let test1 = parse_center_id_filter(Some(vec![
        "69ef3c5dd31f9e88d00c133c,69ef3c5dd31f9e88d00c133d".to_string(),
    ]));
    println!("test1: {:?}", test1);

    let test2 = parse_center_id_filter(Some(vec![
        "69ef3c5dd31f9e88d00c133c".to_string(),
        "69ef3c5dd31f9e88d00c133d".to_string(),
    ]));
    println!("test2: {:?}", test2);
}
