
use bcrypt::verify;

fn main() {
    let password = "scre-0004@123";
    let hash = "$2b$12$pDROLthhVHPX1S1.IZh4V.T3DWBRrixfpzXq218SaLpVwrxdPfTzi";

    println!("Testing password verification:");
    println!("  Password: {:?}", password);
    println!("  Hash: {:?}", hash);

    match verify(password, hash) {
        Ok(result) => {
            println!("  Verification result: {}", result);
            if !result {
                println!("  Generating new hash for the same password...");
                let new_hash = bcrypt::hash(password, bcrypt::DEFAULT_COST).unwrap();
                println!("  New hash: {}", new_hash);
                let new_result = verify(password, &new_hash).unwrap();
                println!("  Verification with new hash: {}", new_result);
            }
        },
        Err(e) => {
            println!("  Verification error: {}", e);
        }
    }
}
