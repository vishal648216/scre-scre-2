
use bcrypt::verify;

fn main() {
    let password = "scre-0004@123";
    let hash = "$2b$12$pDROLthhVHPX1S1.IZh4V.T3DWBRrixfpzXq218SaLpVwrxdPfTzi";
    
    match verify(password, hash) {
        Ok(result) => println!("Verification result: {}", result),
        Err(e) => println!("Verification error: {}", e),
    }
}
