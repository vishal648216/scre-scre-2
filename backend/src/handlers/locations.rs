use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use chrono::Utc;
use futures_util::StreamExt;
use mongodb::{
    Database,
    bson::{doc, oid::ObjectId},
};
use serde::{Deserialize, Serialize};

use crate::models::geo_location::{
    GeoArea, GeoCity, GeoCountry, GeoDistrict, GeoPinCode, GeoState,
};
use crate::models::user::{Claims, UserRole};

const INDIAN_STATES: &[&str] = &[
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
];

fn admin_ok(claims: &Claims) -> bool {
    matches!(claims.role, UserRole::Admin | UserRole::SuperAdmin)
}

fn oid(s: &str) -> Result<ObjectId, ()> {
    ObjectId::parse_str(s).map_err(|_| ())
}

#[derive(Serialize)]
pub struct GeoItemDto {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
}

#[derive(Deserialize)]
pub struct ListByParent {
    pub country_id: Option<String>,
    pub state_id: Option<String>,
    pub district_id: Option<String>,
    pub city_id: Option<String>,
    pub pincode_id: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateCountryBody {
    pub name: String,
    pub code: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateStateBody {
    pub country_id: String,
    pub name: String,
}

#[derive(Deserialize)]
pub struct BulkNamesBody {
    pub country_id: Option<String>,
    pub state_id: Option<String>,
    pub district_id: Option<String>,
    pub city_id: Option<String>,
    pub pincode_id: Option<String>,
    pub names: Vec<String>,
}

#[derive(Deserialize)]
pub struct CreateDistrictBody {
    pub state_id: String,
    pub name: String,
}

#[derive(Deserialize)]
pub struct CreateCityBody {
    pub district_id: String,
    pub name: String,
}

#[derive(Deserialize)]
pub struct CreatePinCodeBody {
    pub city_id: String,
    pub name: String,
}

#[derive(Deserialize)]
pub struct CreateAreaBody {
    pub city_id: Option<String>,
    pub pincode_id: Option<String>,
    pub name: String,
}

#[derive(Serialize)]
pub struct OkMsg {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inserted: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skipped: Option<u32>,
}

pub async fn list_countries(
    State(db): State<Database>,
    claims: Claims,
) -> Result<Json<Vec<GeoItemDto>>, StatusCode> {
    if !admin_ok(&claims) {
        return Err(StatusCode::FORBIDDEN);
    }
    list_countries_internal(db).await
}

pub async fn public_list_countries(
    State(db): State<Database>,
) -> Result<Json<Vec<GeoItemDto>>, StatusCode> {
    list_countries_internal(db).await
}

async fn list_countries_internal(db: Database) -> Result<Json<Vec<GeoItemDto>>, StatusCode> {
    let coll = db.collection::<GeoCountry>("geo_countries");
    let mut cur = coll
        .find(
            doc! {},
            mongodb::options::FindOptions::builder()
                .sort(doc! { "name": 1 })
                .build(),
        )
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut out = Vec::new();
    while let Some(doc) = cur.next().await {
        let c = doc.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let id = c.id.ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
        out.push(GeoItemDto {
            id: id.to_hex(),
            name: c.name,
            code: c.code,
        });
    }
    Ok(Json(out))
}

pub async fn create_country(
    State(db): State<Database>,
    claims: Claims,
    Json(body): Json<CreateCountryBody>,
) -> (StatusCode, Json<OkMsg>) {
    if !admin_ok(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Forbidden".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let name = body.name.trim();
    if name.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(OkMsg {
                success: false,
                message: "Name required".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let coll = db.collection::<GeoCountry>("geo_countries");
    let exists = coll
        .find_one(doc! { "name": name }, None)
        .await
        .ok()
        .flatten();
    if exists.is_some() {
        return (
            StatusCode::CONFLICT,
            Json(OkMsg {
                success: false,
                message: "Country already exists".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let now = Utc::now();
    let doc = GeoCountry {
        id: None,
        name: name.to_string(),
        code: body
            .code
            .filter(|c| !c.trim().is_empty())
            .map(|c| c.trim().to_string()),
        created_at: now,
    };
    match coll.insert_one(doc, None).await {
        Ok(r) => {
            let id = r.inserted_id.as_object_id().map(|o| o.to_hex());
            (
                StatusCode::CREATED,
                Json(OkMsg {
                    success: true,
                    message: "Created".into(),
                    id,
                    inserted: None,
                    skipped: None,
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(OkMsg {
                success: false,
                message: "Insert failed".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
    }
}

pub async fn list_states(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<ListByParent>,
) -> Result<Json<Vec<GeoItemDto>>, StatusCode> {
    if !admin_ok(&claims) {
        return Err(StatusCode::FORBIDDEN);
    }
    list_states_internal(db, q).await
}

pub async fn public_list_states(
    State(db): State<Database>,
    Query(q): Query<ListByParent>,
) -> Result<Json<Vec<GeoItemDto>>, StatusCode> {
    list_states_internal(db, q).await
}

async fn list_states_internal(
    db: Database,
    q: ListByParent,
) -> Result<Json<Vec<GeoItemDto>>, StatusCode> {
    let cid = q.country_id.as_deref().ok_or(StatusCode::BAD_REQUEST)?;
    let country_id = oid(cid).map_err(|_| StatusCode::BAD_REQUEST)?;
    let coll = db.collection::<GeoState>("geo_states");
    let mut cur = coll
        .find(
            doc! { "country_id": country_id },
            mongodb::options::FindOptions::builder()
                .sort(doc! { "name": 1 })
                .build(),
        )
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut out = Vec::new();
    while let Some(doc) = cur.next().await {
        let s = doc.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let id = s.id.ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
        out.push(GeoItemDto {
            id: id.to_hex(),
            name: s.name,
            code: None,
        });
    }
    Ok(Json(out))
}

pub async fn create_state(
    State(db): State<Database>,
    claims: Claims,
    Json(body): Json<CreateStateBody>,
) -> (StatusCode, Json<OkMsg>) {
    if !admin_ok(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Forbidden".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let country_id = match oid(&body.country_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(OkMsg {
                    success: false,
                    message: "Invalid country_id".into(),
                    id: None,
                    inserted: None,
                    skipped: None,
                }),
            );
        }
    };
    let name = body.name.trim();
    if name.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(OkMsg {
                success: false,
                message: "Name required".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let coll = db.collection::<GeoState>("geo_states");
    let exists = coll
        .find_one(doc! { "country_id": country_id, "name": name }, None)
        .await
        .ok()
        .flatten();
    if exists.is_some() {
        return (
            StatusCode::CONFLICT,
            Json(OkMsg {
                success: false,
                message: "State exists in this country".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let doc = GeoState {
        id: None,
        country_id,
        name: name.to_string(),
        created_at: Utc::now(),
    };
    match coll.insert_one(doc, None).await {
        Ok(r) => {
            let id = r.inserted_id.as_object_id().map(|o| o.to_hex());
            (
                StatusCode::CREATED,
                Json(OkMsg {
                    success: true,
                    message: "Created".into(),
                    id,
                    inserted: None,
                    skipped: None,
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(OkMsg {
                success: false,
                message: "Insert failed".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
    }
}

pub async fn bulk_states(
    State(db): State<Database>,
    claims: Claims,
    Json(body): Json<BulkNamesBody>,
) -> (StatusCode, Json<OkMsg>) {
    if !admin_ok(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Forbidden".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let Some(cid) = body.country_id.as_deref() else {
        return (
            StatusCode::BAD_REQUEST,
            Json(OkMsg {
                success: false,
                message: "country_id required".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    };
    let country_id = match oid(cid) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(OkMsg {
                    success: false,
                    message: "Invalid country_id".into(),
                    id: None,
                    inserted: None,
                    skipped: None,
                }),
            );
        }
    };
    let coll = db.collection::<GeoState>("geo_states");
    let mut inserted = 0u32;
    let mut skipped = 0u32;
    for raw in body.names {
        let name = raw.trim();
        if name.is_empty() {
            continue;
        }
        let exists = coll
            .find_one(doc! { "country_id": country_id, "name": name }, None)
            .await
            .ok()
            .flatten();
        if exists.is_some() {
            skipped += 1;
            continue;
        }
        let doc = GeoState {
            id: None,
            country_id,
            name: name.to_string(),
            created_at: Utc::now(),
        };
        if coll.insert_one(doc, None).await.is_ok() {
            inserted += 1;
        } else {
            skipped += 1;
        }
    }
    (
        StatusCode::OK,
        Json(OkMsg {
            success: true,
            message: format!("Inserted {inserted}, skipped {skipped}"),
            id: None,
            inserted: Some(inserted),
            skipped: Some(skipped),
        }),
    )
}

pub async fn list_cities(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<ListByParent>,
) -> Result<Json<Vec<GeoItemDto>>, StatusCode> {
    if !admin_ok(&claims) {
        return Err(StatusCode::FORBIDDEN);
    }
    list_cities_internal(db, q).await
}

pub async fn public_list_cities(
    State(db): State<Database>,
    Query(q): Query<ListByParent>,
) -> Result<Json<Vec<GeoItemDto>>, StatusCode> {
    list_cities_internal(db, q).await
}

async fn list_cities_internal(
    db: Database,
    q: ListByParent,
) -> Result<Json<Vec<GeoItemDto>>, StatusCode> {
    let did = q.district_id.as_deref().ok_or(StatusCode::BAD_REQUEST)?;
    let district_id = oid(did).map_err(|_| StatusCode::BAD_REQUEST)?;
    let coll = db.collection::<GeoCity>("geo_cities");
    let mut cur = coll
        .find(
            doc! { "district_id": district_id },
            mongodb::options::FindOptions::builder()
                .sort(doc! { "name": 1 })
                .build(),
        )
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut out = Vec::new();
    while let Some(doc) = cur.next().await {
        let c = doc.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let id = c.id.ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
        out.push(GeoItemDto {
            id: id.to_hex(),
            name: c.name,
            code: None,
        });
    }
    Ok(Json(out))
}

pub async fn create_city(
    State(db): State<Database>,
    claims: Claims,
    Json(body): Json<CreateCityBody>,
) -> (StatusCode, Json<OkMsg>) {
    if !admin_ok(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Forbidden".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let district_id = match oid(&body.district_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(OkMsg {
                    success: false,
                    message: "Invalid district_id".into(),
                    id: None,
                    inserted: None,
                    skipped: None,
                }),
            );
        }
    };
    let name = body.name.trim();
    if name.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(OkMsg {
                success: false,
                message: "Name required".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let coll = db.collection::<GeoCity>("geo_cities");
    let exists = coll
        .find_one(doc! { "district_id": district_id, "name": name }, None)
        .await
        .ok()
        .flatten();
    if exists.is_some() {
        return (
            StatusCode::CONFLICT,
            Json(OkMsg {
                success: false,
                message: "City exists in this district".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let doc = GeoCity {
        id: None,
        district_id,
        name: name.to_string(),
        created_at: Utc::now(),
    };
    match coll.insert_one(doc, None).await {
        Ok(r) => {
            let id = r.inserted_id.as_object_id().map(|o| o.to_hex());
            (
                StatusCode::CREATED,
                Json(OkMsg {
                    success: true,
                    message: "Created".into(),
                    id,
                    inserted: None,
                    skipped: None,
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(OkMsg {
                success: false,
                message: "Insert failed".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
    }
}

pub async fn bulk_cities(
    State(db): State<Database>,
    claims: Claims,
    Json(body): Json<BulkNamesBody>,
) -> (StatusCode, Json<OkMsg>) {
    if !admin_ok(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Forbidden".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let Some(did) = body.district_id.as_deref() else {
        return (
            StatusCode::BAD_REQUEST,
            Json(OkMsg {
                success: false,
                message: "district_id required".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    };
    let district_id = match oid(did) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(OkMsg {
                    success: false,
                    message: "Invalid district_id".into(),
                    id: None,
                    inserted: None,
                    skipped: None,
                }),
            );
        }
    };
    let coll = db.collection::<GeoCity>("geo_cities");
    let mut inserted = 0u32;
    let mut skipped = 0u32;
    for raw in body.names {
        let name = raw.trim();
        if name.is_empty() {
            continue;
        }
        let exists = coll
            .find_one(doc! { "district_id": district_id, "name": name }, None)
            .await
            .ok()
            .flatten();
        if exists.is_some() {
            skipped += 1;
            continue;
        }
        let doc = GeoCity {
            id: None,
            district_id,
            name: name.to_string(),
            created_at: Utc::now(),
        };
        if coll.insert_one(doc, None).await.is_ok() {
            inserted += 1;
        } else {
            skipped += 1;
        }
    }
    (
        StatusCode::OK,
        Json(OkMsg {
            success: true,
            message: format!("Inserted {inserted}, skipped {skipped}"),
            id: None,
            inserted: Some(inserted),
            skipped: Some(skipped),
        }),
    )
}

pub async fn list_areas(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<ListByParent>,
) -> Result<Json<Vec<GeoItemDto>>, StatusCode> {
    if !admin_ok(&claims) {
        return Err(StatusCode::FORBIDDEN);
    }
    let coll = db.collection::<GeoArea>("geo_areas");
    let filter = if let Some(pid) = &q.pincode_id {
        let pincode_id = oid(pid).map_err(|_| StatusCode::BAD_REQUEST)?;
        doc! { "pincode_id": pincode_id }
    } else if let Some(did) = &q.city_id {
        let city_id = oid(did).map_err(|_| StatusCode::BAD_REQUEST)?;
        doc! { "city_id": city_id }
    } else if let Some(cid) = &q.district_id {
        let district_id = oid(cid).map_err(|_| StatusCode::BAD_REQUEST)?;
        // First get all city ids for this district
        let city_coll = db.collection::<GeoCity>("geo_cities");
        let mut city_cur = city_coll
            .find(doc! { "district_id": district_id }, None)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let mut city_ids = Vec::new();
        while let Some(city) = city_cur.next().await {
            if let Ok(c) = city {
                if let Some(id) = c.id {
                    city_ids.push(id);
                }
            }
        }
        doc! { "city_id": { "$in": city_ids } }
    } else if let Some(sid) = &q.state_id {
        let state_id = oid(sid).map_err(|_| StatusCode::BAD_REQUEST)?;
        // First get all district ids for this state
        let district_coll = db.collection::<GeoDistrict>("geo_districts");
        let mut district_cur = district_coll
            .find(doc! { "state_id": state_id }, None)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let mut district_ids = Vec::new();
        while let Some(district) = district_cur.next().await {
            if let Ok(d) = district {
                if let Some(id) = d.id {
                    district_ids.push(id);
                }
            }
        }
        // Get all city ids
        let city_coll = db.collection::<GeoCity>("geo_cities");
        let mut city_cur = city_coll
            .find(doc! { "district_id": { "$in": district_ids } }, None)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let mut city_ids = Vec::new();
        while let Some(city) = city_cur.next().await {
            if let Ok(c) = city {
                if let Some(id) = c.id {
                    city_ids.push(id);
                }
            }
        }
        doc! { "city_id": { "$in": city_ids } }
    } else if let Some(cid) = &q.country_id {
        let country_id = oid(cid).map_err(|_| StatusCode::BAD_REQUEST)?;
        // First get all state ids
        let state_coll = db.collection::<GeoState>("geo_states");
        let mut state_cur = state_coll
            .find(doc! { "country_id": country_id }, None)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let mut state_ids = Vec::new();
        while let Some(state) = state_cur.next().await {
            if let Ok(s) = state {
                if let Some(id) = s.id {
                    state_ids.push(id);
                }
            }
        }
        // Get all district ids
        let district_coll = db.collection::<GeoDistrict>("geo_districts");
        let mut district_cur = district_coll
            .find(doc! { "state_id": { "$in": state_ids } }, None)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let mut district_ids = Vec::new();
        while let Some(district) = district_cur.next().await {
            if let Ok(d) = district {
                if let Some(id) = d.id {
                    district_ids.push(id);
                }
            }
        }
        // Get all city ids
        let city_coll = db.collection::<GeoCity>("geo_cities");
        let mut city_cur = city_coll
            .find(doc! { "district_id": { "$in": district_ids } }, None)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let mut city_ids = Vec::new();
        while let Some(city) = city_cur.next().await {
            if let Ok(c) = city {
                if let Some(id) = c.id {
                    city_ids.push(id);
                }
            }
        }
        doc! { "city_id": { "$in": city_ids } }
    } else {
        return Err(StatusCode::BAD_REQUEST);
    };
    let mut cur = coll
        .find(
            filter,
            mongodb::options::FindOptions::builder()
                .sort(doc! { "name": 1 })
                .build(),
        )
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut out = Vec::new();
    while let Some(doc) = cur.next().await {
        let a = doc.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let id = a.id.ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
        out.push(GeoItemDto {
            id: id.to_hex(),
            name: a.name,
            code: None,
        });
    }
    Ok(Json(out))
}

pub async fn create_area(
    State(db): State<Database>,
    claims: Claims,
    Json(body): Json<CreateAreaBody>,
) -> (StatusCode, Json<OkMsg>) {
    if !admin_ok(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Forbidden".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let pincode_id = body.pincode_id.as_deref().and_then(|s| oid(s).ok());
    let city_id = body.city_id.as_deref().and_then(|s| oid(s).ok());

    if pincode_id.is_none() && city_id.is_none() {
        return (
            StatusCode::BAD_REQUEST,
            Json(OkMsg {
                success: false,
                message: "Either city_id or pincode_id required".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }

    let name = body.name.trim();
    if name.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(OkMsg {
                success: false,
                message: "Name required".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }

    let coll = db.collection::<GeoArea>("geo_areas");

    // Check for existing area
    let mut filter = doc! { "name": name };
    if let Some(pid) = pincode_id {
        filter.insert("pincode_id", pid);
    }
    if let Some(cid) = city_id {
        filter.insert("city_id", cid);
    }

    let exists = coll.find_one(filter, None).await.ok().flatten();

    if exists.is_some() {
        return (
            StatusCode::CONFLICT,
            Json(OkMsg {
                success: false,
                message: "Area already exists".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }

    let doc = GeoArea {
        id: None,
        pincode_id,
        city_id,
        district_id: None,
        name: name.to_string(),
        created_at: Utc::now(),
    };
    match coll.insert_one(doc, None).await {
        Ok(r) => {
            let id = r.inserted_id.as_object_id().map(|o| o.to_hex());
            (
                StatusCode::CREATED,
                Json(OkMsg {
                    success: true,
                    message: "Created".into(),
                    id,
                    inserted: None,
                    skipped: None,
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(OkMsg {
                success: false,
                message: "Insert failed".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
    }
}

pub async fn bulk_areas(
    State(db): State<Database>,
    claims: Claims,
    Json(body): Json<BulkNamesBody>,
) -> (StatusCode, Json<OkMsg>) {
    if !admin_ok(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Forbidden".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let pincode_id = body.pincode_id.as_deref().and_then(|s| oid(s).ok());
    let city_id = body.city_id.as_deref().and_then(|s| oid(s).ok());

    if pincode_id.is_none() && city_id.is_none() {
        return (
            StatusCode::BAD_REQUEST,
            Json(OkMsg {
                success: false,
                message: "Either city_id or pincode_id required".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }

    let coll = db.collection::<GeoArea>("geo_areas");
    let mut inserted = 0u32;
    let mut skipped = 0u32;
    for raw in body.names {
        let name = raw.trim();
        if name.is_empty() {
            continue;
        }

        // Check for existing area
        let mut filter = doc! { "name": name };
        if let Some(pid) = pincode_id {
            filter.insert("pincode_id", pid);
        }
        if let Some(cid) = city_id {
            filter.insert("city_id", cid);
        }

        let exists = coll.find_one(filter, None).await.ok().flatten();

        if exists.is_some() {
            skipped += 1;
            continue;
        }

        let doc = GeoArea {
            id: None,
            pincode_id,
            city_id,
            district_id: None,
            name: name.to_string(),
            created_at: Utc::now(),
        };
        if coll.insert_one(doc, None).await.is_ok() {
            inserted += 1;
        } else {
            skipped += 1;
        }
    }
    (
        StatusCode::OK,
        Json(OkMsg {
            success: true,
            message: format!("Inserted {inserted}, skipped {skipped}"),
            id: None,
            inserted: Some(inserted),
            skipped: Some(skipped),
        }),
    )
}

async fn collect_oids(
    db: &Database,
    coll_name: &str,
    filter: mongodb::bson::Document,
) -> Result<Vec<ObjectId>, mongodb::error::Error> {
    let coll = db.collection::<mongodb::bson::Document>(coll_name);
    let mut cur = coll.find(filter, None).await?;
    let mut ids = Vec::new();
    while let Some(d) = cur.next().await {
        let d = d?;
        if let Some(oid) = d.get_object_id("_id").ok() {
            ids.push(oid);
        }
    }
    Ok(ids)
}

pub async fn delete_country(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<OkMsg>) {
    if !admin_ok(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Forbidden".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let country_id = match oid(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(OkMsg {
                    success: false,
                    message: "Invalid id".into(),
                    id: None,
                    inserted: None,
                    skipped: None,
                }),
            );
        }
    };
    let state_ids = match collect_oids(&db, "geo_states", doc! { "country_id": country_id }).await {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(OkMsg {
                    success: false,
                    message: "List states failed".into(),
                    id: None,
                    inserted: None,
                    skipped: None,
                }),
            );
        }
    };
    if !state_ids.is_empty() {
        // Collect districts under these states
        let district_ids = match collect_oids(
            &db,
            "geo_districts",
            doc! { "state_id": { "$in": state_ids.clone() } },
        )
        .await
        {
            Ok(v) => v,
            Err(_) => Vec::new(),
        };
        if !district_ids.is_empty() {
            // Collect cities under these districts
            let city_ids = match collect_oids(
                &db,
                "geo_cities",
                doc! { "district_id": { "$in": district_ids.clone() } },
            )
            .await
            {
                Ok(v) => v,
                Err(_) => Vec::new(),
            };
            if !city_ids.is_empty() {
                // Collect pincodes under these cities
                let pincode_ids = match collect_oids(
                    &db,
                    "geo_pincodes",
                    doc! { "city_id": { "$in": city_ids.clone() } },
                )
                .await
                {
                    Ok(v) => v,
                    Err(_) => Vec::new(),
                };
                if !pincode_ids.is_empty() {
                    let _ = db
                        .collection::<GeoArea>("geo_areas")
                        .delete_many(doc! { "pincode_id": { "$in": pincode_ids.clone() } }, None)
                        .await;
                    let _ = db
                        .collection::<GeoPinCode>("geo_pincodes")
                        .delete_many(doc! { "_id": { "$in": pincode_ids } }, None)
                        .await;
                }
                // Also delete any areas directly linked to cities (for backwards compatibility)
                let _ = db
                    .collection::<GeoArea>("geo_areas")
                    .delete_many(doc! { "city_id": { "$in": city_ids.clone() } }, None)
                    .await;
                let _ = db
                    .collection::<GeoCity>("geo_cities")
                    .delete_many(doc! { "_id": { "$in": city_ids } }, None)
                    .await;
            }
            let _ = db
                .collection::<GeoDistrict>("geo_districts")
                .delete_many(doc! { "_id": { "$in": district_ids } }, None)
                .await;
        }
        let _ = db
            .collection::<GeoState>("geo_states")
            .delete_many(doc! { "_id": { "$in": state_ids } }, None)
            .await;
    }
    let coll = db.collection::<GeoCountry>("geo_countries");
    match coll.delete_one(doc! { "_id": country_id }, None).await {
        Ok(r) if r.deleted_count > 0 => (
            StatusCode::OK,
            Json(OkMsg {
                success: true,
                message: "Deleted country and nested data".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(OkMsg {
                success: false,
                message: "Not found".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(OkMsg {
                success: false,
                message: "Delete failed".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
    }
}

pub async fn delete_state(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<OkMsg>) {
    if !admin_ok(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Forbidden".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let state_id = match oid(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(OkMsg {
                    success: false,
                    message: "Invalid id".into(),
                    id: None,
                    inserted: None,
                    skipped: None,
                }),
            );
        }
    };
    // Collect districts under this state
    let district_ids = match collect_oids(&db, "geo_districts", doc! { "state_id": state_id }).await
    {
        Ok(v) => v,
        Err(_) => Vec::new(),
    };
    if !district_ids.is_empty() {
        // Collect cities under these districts
        let city_ids = match collect_oids(
            &db,
            "geo_cities",
            doc! { "district_id": { "$in": district_ids.clone() } },
        )
        .await
        {
            Ok(v) => v,
            Err(_) => Vec::new(),
        };
        if !city_ids.is_empty() {
            // Collect pincodes under these cities
            let pincode_ids = match collect_oids(
                &db,
                "geo_pincodes",
                doc! { "city_id": { "$in": city_ids.clone() } },
            )
            .await
            {
                Ok(v) => v,
                Err(_) => Vec::new(),
            };
            if !pincode_ids.is_empty() {
                let _ = db
                    .collection::<GeoArea>("geo_areas")
                    .delete_many(doc! { "pincode_id": { "$in": pincode_ids.clone() } }, None)
                    .await;
                let _ = db
                    .collection::<GeoPinCode>("geo_pincodes")
                    .delete_many(doc! { "_id": { "$in": pincode_ids } }, None)
                    .await;
            }
            // Also delete any areas directly linked to cities (for backwards compatibility)
            let _ = db
                .collection::<GeoArea>("geo_areas")
                .delete_many(doc! { "city_id": { "$in": city_ids.clone() } }, None)
                .await;
            let _ = db
                .collection::<GeoCity>("geo_cities")
                .delete_many(doc! { "_id": { "$in": city_ids } }, None)
                .await;
        }
        let _ = db
            .collection::<GeoDistrict>("geo_districts")
            .delete_many(doc! { "_id": { "$in": district_ids } }, None)
            .await;
    }
    let coll = db.collection::<GeoState>("geo_states");
    match coll.delete_one(doc! { "_id": state_id }, None).await {
        Ok(r) if r.deleted_count > 0 => (
            StatusCode::OK,
            Json(OkMsg {
                success: true,
                message: "Deleted state and nested data".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(OkMsg {
                success: false,
                message: "Not found".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(OkMsg {
                success: false,
                message: "Delete failed".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
    }
}

pub async fn delete_city(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<OkMsg>) {
    if !admin_ok(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Forbidden".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let city_id = match oid(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(OkMsg {
                    success: false,
                    message: "Invalid id".into(),
                    id: None,
                    inserted: None,
                    skipped: None,
                }),
            );
        }
    };
    let pincode_ids = match collect_oids(&db, "geo_pincodes", doc! { "city_id": city_id }).await {
        Ok(v) => v,
        Err(_) => Vec::new(),
    };

    if !pincode_ids.is_empty() {
        let _ = db
            .collection::<GeoArea>("geo_areas")
            .delete_many(doc! { "pincode_id": { "$in": pincode_ids.clone() } }, None)
            .await;
        let _ = db
            .collection::<GeoPinCode>("geo_pincodes")
            .delete_many(doc! { "_id": { "$in": pincode_ids } }, None)
            .await;
    }
    // Also delete any areas directly linked to this city (for backwards compatibility)
    let _ = db
        .collection::<GeoArea>("geo_areas")
        .delete_many(doc! { "city_id": city_id }, None)
        .await;
    let coll = db.collection::<GeoCity>("geo_cities");
    match coll.delete_one(doc! { "_id": city_id }, None).await {
        Ok(r) if r.deleted_count > 0 => (
            StatusCode::OK,
            Json(OkMsg {
                success: true,
                message: "Deleted city and nested data".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(OkMsg {
                success: false,
                message: "Not found".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(OkMsg {
                success: false,
                message: "Delete failed".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
    }
}

pub async fn delete_area(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<OkMsg>) {
    if !admin_ok(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Forbidden".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let area_id = match oid(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(OkMsg {
                    success: false,
                    message: "Invalid id".into(),
                    id: None,
                    inserted: None,
                    skipped: None,
                }),
            );
        }
    };
    let coll = db.collection::<GeoArea>("geo_areas");
    match coll.delete_one(doc! { "_id": area_id }, None).await {
        Ok(r) if r.deleted_count > 0 => (
            StatusCode::OK,
            Json(OkMsg {
                success: true,
                message: "Deleted".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(OkMsg {
                success: false,
                message: "Not found".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(OkMsg {
                success: false,
                message: "Delete failed".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
    }
}

pub async fn list_districts(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<ListByParent>,
) -> Result<Json<Vec<GeoItemDto>>, StatusCode> {
    if !admin_ok(&claims) {
        return Err(StatusCode::FORBIDDEN);
    }
    list_districts_internal(db, q).await
}

pub async fn public_list_districts(
    State(db): State<Database>,
    Query(q): Query<ListByParent>,
) -> Result<Json<Vec<GeoItemDto>>, StatusCode> {
    list_districts_internal(db, q).await
}

async fn list_districts_internal(
    db: Database,
    q: ListByParent,
) -> Result<Json<Vec<GeoItemDto>>, StatusCode> {
    let state_id_str = q.state_id.as_deref().ok_or(StatusCode::BAD_REQUEST)?;
    let state_id = oid(state_id_str).map_err(|_| StatusCode::BAD_REQUEST)?;
    let coll = db.collection::<GeoDistrict>("geo_districts");
    let mut cur = coll
        .find(
            doc! { "state_id": state_id },
            mongodb::options::FindOptions::builder()
                .sort(doc! { "name": 1 })
                .build(),
        )
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut out = Vec::new();
    while let Some(doc) = cur.next().await {
        let d = doc.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let id = d.id.ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
        out.push(GeoItemDto {
            id: id.to_hex(),
            name: d.name,
            code: None,
        });
    }
    Ok(Json(out))
}

pub async fn create_district(
    State(db): State<Database>,
    claims: Claims,
    Json(body): Json<CreateDistrictBody>,
) -> (StatusCode, Json<OkMsg>) {
    if !admin_ok(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Forbidden".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let state_id = match oid(&body.state_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(OkMsg {
                    success: false,
                    message: "Invalid state_id".into(),
                    id: None,
                    inserted: None,
                    skipped: None,
                }),
            );
        }
    };
    let name = body.name.trim();
    if name.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(OkMsg {
                success: false,
                message: "Name required".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let coll = db.collection::<GeoDistrict>("geo_districts");
    let exists = coll
        .find_one(doc! { "state_id": state_id, "name": name }, None)
        .await
        .ok()
        .flatten();
    if exists.is_some() {
        return (
            StatusCode::CONFLICT,
            Json(OkMsg {
                success: false,
                message: "District exists in this state".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let now = Utc::now();
    let doc = GeoDistrict {
        id: None,
        state_id,
        name: name.to_string(),
        created_at: now,
    };
    match coll.insert_one(doc, None).await {
        Ok(r) => {
            let id = r.inserted_id.as_object_id().map(|o| o.to_hex());
            (
                StatusCode::CREATED,
                Json(OkMsg {
                    success: true,
                    message: "Created".into(),
                    id,
                    inserted: None,
                    skipped: None,
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(OkMsg {
                success: false,
                message: "Insert failed".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
    }
}

pub async fn bulk_districts(
    State(db): State<Database>,
    claims: Claims,
    Json(body): Json<BulkNamesBody>,
) -> (StatusCode, Json<OkMsg>) {
    if !admin_ok(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Forbidden".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let Some(state_id_str) = body.state_id.as_deref() else {
        return (
            StatusCode::BAD_REQUEST,
            Json(OkMsg {
                success: false,
                message: "state_id required".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    };
    let state_id = match oid(state_id_str) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(OkMsg {
                    success: false,
                    message: "Invalid state_id".into(),
                    id: None,
                    inserted: None,
                    skipped: None,
                }),
            );
        }
    };
    let coll = db.collection::<GeoDistrict>("geo_districts");
    let mut inserted = 0u32;
    let mut skipped = 0u32;
    for raw in body.names {
        let name = raw.trim();
        if name.is_empty() {
            continue;
        }
        let exists = coll
            .find_one(doc! { "state_id": state_id, "name": name }, None)
            .await
            .ok()
            .flatten();
        if exists.is_some() {
            skipped += 1;
            continue;
        }
        let doc = GeoDistrict {
            id: None,
            state_id,
            name: name.to_string(),
            created_at: Utc::now(),
        };
        if coll.insert_one(doc, None).await.is_ok() {
            inserted += 1;
        } else {
            skipped += 1;
        }
    }
    (
        StatusCode::OK,
        Json(OkMsg {
            success: true,
            message: format!("Inserted {}, skipped {}", inserted, skipped),
            id: None,
            inserted: Some(inserted),
            skipped: Some(skipped),
        }),
    )
}

pub async fn delete_district(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<OkMsg>) {
    if !admin_ok(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Forbidden".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let district_id = match oid(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(OkMsg {
                    success: false,
                    message: "Invalid id".into(),
                    id: None,
                    inserted: None,
                    skipped: None,
                }),
            );
        }
    };
    // Collect cities under this district
    let city_ids = match collect_oids(&db, "geo_cities", doc! { "district_id": district_id }).await
    {
        Ok(v) => v,
        Err(_) => Vec::new(),
    };
    if !city_ids.is_empty() {
        // Collect pincodes under these cities
        let pincode_ids = match collect_oids(
            &db,
            "geo_pincodes",
            doc! { "city_id": { "$in": city_ids.clone() } },
        )
        .await
        {
            Ok(v) => v,
            Err(_) => Vec::new(),
        };
        if !pincode_ids.is_empty() {
            let _ = db
                .collection::<GeoArea>("geo_areas")
                .delete_many(doc! { "pincode_id": { "$in": pincode_ids.clone() } }, None)
                .await;
            let _ = db
                .collection::<GeoPinCode>("geo_pincodes")
                .delete_many(doc! { "_id": { "$in": pincode_ids } }, None)
                .await;
        }
        // Also delete any areas directly linked to cities (for backwards compatibility)
        let _ = db
            .collection::<GeoArea>("geo_areas")
            .delete_many(doc! { "city_id": { "$in": city_ids.clone() } }, None)
            .await;
        let _ = db
            .collection::<GeoCity>("geo_cities")
            .delete_many(doc! { "_id": { "$in": city_ids } }, None)
            .await;
    }
    let coll = db.collection::<GeoDistrict>("geo_districts");
    match coll.delete_one(doc! { "_id": district_id }, None).await {
        Ok(r) if r.deleted_count > 0 => (
            StatusCode::OK,
            Json(OkMsg {
                success: true,
                message: "Deleted district and nested data".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(OkMsg {
                success: false,
                message: "Not found".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(OkMsg {
                success: false,
                message: "Delete failed".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
    }
}

pub async fn list_pincodes(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<ListByParent>,
) -> Result<Json<Vec<GeoItemDto>>, StatusCode> {
    if !admin_ok(&claims) {
        return Err(StatusCode::FORBIDDEN);
    }
    list_pincodes_internal(db, q).await
}

pub async fn public_list_pincodes(
    State(db): State<Database>,
    Query(q): Query<ListByParent>,
) -> Result<Json<Vec<GeoItemDto>>, StatusCode> {
    list_pincodes_internal(db, q).await
}

async fn list_pincodes_internal(
    db: Database,
    q: ListByParent,
) -> Result<Json<Vec<GeoItemDto>>, StatusCode> {
    let city_id_str = q.city_id.as_deref().ok_or(StatusCode::BAD_REQUEST)?;
    let city_id = oid(city_id_str).map_err(|_| StatusCode::BAD_REQUEST)?;
    let coll = db.collection::<GeoPinCode>("geo_pincodes");
    let mut cur = coll
        .find(
            doc! { "city_id": city_id },
            mongodb::options::FindOptions::builder()
                .sort(doc! { "name": 1 })
                .build(),
        )
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut out = Vec::new();
    while let Some(doc) = cur.next().await {
        let p = doc.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let id = p.id.ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
        out.push(GeoItemDto {
            id: id.to_hex(),
            name: p.name,
            code: None,
        });
    }
    Ok(Json(out))
}

pub async fn create_pincode(
    State(db): State<Database>,
    claims: Claims,
    Json(body): Json<CreatePinCodeBody>,
) -> (StatusCode, Json<OkMsg>) {
    if !admin_ok(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Forbidden".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let city_id = match oid(&body.city_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(OkMsg {
                    success: false,
                    message: "Invalid city_id".into(),
                    id: None,
                    inserted: None,
                    skipped: None,
                }),
            );
        }
    };
    let name = body.name.trim();
    if name.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(OkMsg {
                success: false,
                message: "Name required".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let coll = db.collection::<GeoPinCode>("geo_pincodes");
    let exists = coll
        .find_one(doc! { "city_id": city_id, "name": name }, None)
        .await
        .ok()
        .flatten();
    if exists.is_some() {
        return (
            StatusCode::CONFLICT,
            Json(OkMsg {
                success: false,
                message: "Pincode exists in this city".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let now = Utc::now();
    let doc = GeoPinCode {
        id: None,
        city_id,
        name: name.to_string(),
        created_at: now,
    };
    match coll.insert_one(doc, None).await {
        Ok(r) => {
            let id = r.inserted_id.as_object_id().map(|o| o.to_hex());
            (
                StatusCode::CREATED,
                Json(OkMsg {
                    success: true,
                    message: "Created".into(),
                    id,
                    inserted: None,
                    skipped: None,
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(OkMsg {
                success: false,
                message: "Insert failed".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
    }
}

pub async fn bulk_pincodes(
    State(db): State<Database>,
    claims: Claims,
    Json(body): Json<BulkNamesBody>,
) -> (StatusCode, Json<OkMsg>) {
    if !admin_ok(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Forbidden".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let Some(city_id_str) = body.city_id.as_deref() else {
        return (
            StatusCode::BAD_REQUEST,
            Json(OkMsg {
                success: false,
                message: "city_id required".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    };
    let city_id = match oid(city_id_str) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(OkMsg {
                    success: false,
                    message: "Invalid city_id".into(),
                    id: None,
                    inserted: None,
                    skipped: None,
                }),
            );
        }
    };
    let coll = db.collection::<GeoPinCode>("geo_pincodes");
    let mut inserted = 0u32;
    let mut skipped = 0u32;
    for raw in body.names {
        let name = raw.trim();
        if name.is_empty() {
            continue;
        }
        let exists = coll
            .find_one(doc! { "city_id": city_id, "name": name }, None)
            .await
            .ok()
            .flatten();
        if exists.is_some() {
            skipped += 1;
            continue;
        }
        let doc = GeoPinCode {
            id: None,
            city_id,
            name: name.to_string(),
            created_at: Utc::now(),
        };
        if coll.insert_one(doc, None).await.is_ok() {
            inserted += 1;
        } else {
            skipped += 1;
        }
    }
    (
        StatusCode::OK,
        Json(OkMsg {
            success: true,
            message: format!("Inserted {}, skipped {}", inserted, skipped),
            id: None,
            inserted: Some(inserted),
            skipped: Some(skipped),
        }),
    )
}

pub async fn delete_pincode(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<OkMsg>) {
    if !admin_ok(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Forbidden".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let pincode_id = match oid(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(OkMsg {
                    success: false,
                    message: "Invalid id".into(),
                    id: None,
                    inserted: None,
                    skipped: None,
                }),
            );
        }
    };
    let _ = db
        .collection::<GeoArea>("geo_areas")
        .delete_many(doc! { "pincode_id": pincode_id }, None)
        .await;
    let coll = db.collection::<GeoPinCode>("geo_pincodes");
    match coll.delete_one(doc! { "_id": pincode_id }, None).await {
        Ok(r) if r.deleted_count > 0 => (
            StatusCode::OK,
            Json(OkMsg {
                success: true,
                message: "Deleted pincode and areas".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(OkMsg {
                success: false,
                message: "Not found".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(OkMsg {
                success: false,
                message: "Delete failed".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        ),
    }
}

/// One-click: India + all union-state names (skips duplicates).
pub async fn seed_india(State(db): State<Database>, claims: Claims) -> (StatusCode, Json<OkMsg>) {
    if !admin_ok(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Forbidden".into(),
                id: None,
                inserted: None,
                skipped: None,
            }),
        );
    }
    let coll_c = db.collection::<GeoCountry>("geo_countries");
    let india = coll_c
        .find_one(doc! { "name": "India" }, None)
        .await
        .ok()
        .flatten();
    let country_id = if let Some(c) = india {
        match c.id {
            Some(id) => id,
            None => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(OkMsg {
                        success: false,
                        message: "India record missing id".into(),
                        id: None,
                        inserted: None,
                        skipped: None,
                    }),
                );
            }
        }
    } else {
        let doc = GeoCountry {
            id: None,
            name: "India".into(),
            code: Some("IN".into()),
            created_at: Utc::now(),
        };
        match coll_c.insert_one(doc, None).await {
            Ok(r) => match r.inserted_id.as_object_id() {
                Some(id) => id,
                None => {
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(OkMsg {
                            success: false,
                            message: "Could not create India".into(),
                            id: None,
                            inserted: None,
                            skipped: None,
                        }),
                    );
                }
            },
            Err(_) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(OkMsg {
                        success: false,
                        message: "Could not create India".into(),
                        id: None,
                        inserted: None,
                        skipped: None,
                    }),
                );
            }
        }
    };
    let coll_s = db.collection::<GeoState>("geo_states");
    let mut n = 0u32;
    for sname in INDIAN_STATES {
        let exists = coll_s
            .find_one(doc! { "country_id": country_id, "name": *sname }, None)
            .await
            .ok()
            .flatten();
        if exists.is_some() {
            continue;
        }
        let st = GeoState {
            id: None,
            country_id,
            name: (*sname).to_string(),
            created_at: Utc::now(),
        };
        if coll_s.insert_one(st, None).await.is_ok() {
            n += 1;
        }
    }
    (
        StatusCode::OK,
        Json(OkMsg {
            success: true,
            message: format!("India ready; inserted {n} new states"),
            id: Some(country_id.to_hex()),
            inserted: Some(n),
            skipped: None,
        }),
    )
}
