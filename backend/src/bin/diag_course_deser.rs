
use backend::db::connect_db;
use backend::models::course::Course;
use futures_util::StreamExt;
use mongodb::bson::{from_document, Document};

#[tokio::main]
async fn main() {
    let (_client, db) = connect_db().await;
    eprintln!("[diag] DB connected.");
    let coll = db.collection::<Document>("courses");
    let mut cursor = match coll.find(None, None).await {
        Ok(c) => c,
        Err(e) => { eprintln!("find failed: {e}"); return; }
    };
    let mut ok = 0usize;
    let mut err = 0usize;
    while let Some(doc_res) = cursor.next().await {
        let doc = match doc_res {
            Ok(d) => d,
            Err(e) => { eprintln!("cursor doc err: {e}"); err += 1; continue; }
        };
        let id = doc.get_object_id("_id").map(|o| o.to_hex()).unwrap_or_default();
        let name = doc.get_str("course_name").unwrap_or("?").to_string();
        match from_document::<Course>(doc.clone()) {
            Ok(_c) => {
                ok += 1;
                eprintln!("  OK course {name} id={id_short}", id_short = &id[..12]);
            }
            Err(e) => {
                err += 1;
                eprintln!("  FAIL course {name} id={id_short}: DESERIALIZE ERROR: {e:#?}", id_short = &id[..12]);
                // print non-defaulted fields with their raw bson type for clue
                for key in ["category_id","course_name","course_code","duration_months","status","created_at"] {
                    let v = doc.get(key);
                    match v {
                        Some(bv) => eprintln!("    field {key}: bson type={:?}", bv.element_type()),
                        None => eprintln!("    field {key}: MISSING"),
                    }
                }
            }
        }
    }
    eprintln!("SUMMARY: ok={ok} err={err}");
}
