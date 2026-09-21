
use chrono::{DateTime, Utc};
use mongodb::bson;
use serde::{Deserialize, Deserializer, Serialize, Serializer};

pub mod flexible_datetime {
    use super::*;

    pub fn deserialize<'de, D>(deserializer: D) -> Result<DateTime<Utc>, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum DateTimeEither {
            BsonDateTime(bson::DateTime),
            String(String),
        }

        match DateTimeEither::deserialize(deserializer)? {
            DateTimeEither::BsonDateTime(dt) => Ok(dt.to_chrono()),
            DateTimeEither::String(s) => {
                DateTime::parse_from_rfc3339(&s)
                    .map(|dt| dt.with_timezone(&Utc))
                    .or_else(|_| {
                        DateTime::parse_from_rfc2822(&s).map(|dt| dt.with_timezone(&Utc))
                    })
                    .map_err(serde::de::Error::custom)
            }
        }
    }

    pub fn serialize<S>(dt: &DateTime<Utc>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        bson::DateTime::from_chrono(*dt).serialize(serializer)
    }
}

pub mod optional_flexible_datetime {
    use super::*;

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<DateTime<Utc>>, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum DateTimeEither {
            BsonDateTime(bson::DateTime),
            String(String),
            Null,
        }

        match Option::<DateTimeEither>::deserialize(deserializer)? {
            None => Ok(None),
            Some(DateTimeEither::Null) => Ok(None),
            Some(DateTimeEither::BsonDateTime(dt)) => Ok(Some(dt.to_chrono())),
            Some(DateTimeEither::String(s)) => {
                DateTime::parse_from_rfc3339(&s)
                    .map(|dt| Some(dt.with_timezone(&Utc)))
                    .or_else(|_| {
                        DateTime::parse_from_rfc2822(&s).map(|dt| Some(dt.with_timezone(&Utc)))
                    })
                    .map_err(serde::de::Error::custom)
            }
        }
    }

    pub fn serialize<S>(dt: &Option<DateTime<Utc>>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match dt {
            Some(dt) => bson::DateTime::from_chrono(*dt).serialize(serializer),
            None => serializer.serialize_none(),
        }
    }
}

pub mod rfc3339_datetime {
    use super::*;

    pub fn deserialize<'de, D>(deserializer: D) -> Result<DateTime<Utc>, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum DateTimeEither {
            BsonDateTime(bson::DateTime),
            String(String),
        }

        match DateTimeEither::deserialize(deserializer)? {
            DateTimeEither::BsonDateTime(dt) => Ok(dt.to_chrono()),
            DateTimeEither::String(s) => {
                DateTime::parse_from_rfc3339(&s)
                    .map(|dt| dt.with_timezone(&Utc))
                    .or_else(|_| {
                        DateTime::parse_from_rfc2822(&s).map(|dt| dt.with_timezone(&Utc))
                    })
                    .map_err(serde::de::Error::custom)
            }
        }
    }

    pub fn serialize<S>(dt: &DateTime<Utc>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        dt.to_rfc3339().serialize(serializer)
    }
}

pub mod optional_rfc3339_datetime {
    use super::*;

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<DateTime<Utc>>, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum DateTimeEither {
            BsonDateTime(bson::DateTime),
            String(String),
            Null,
        }

        match Option::<DateTimeEither>::deserialize(deserializer)? {
            None => Ok(None),
            Some(DateTimeEither::Null) => Ok(None),
            Some(DateTimeEither::BsonDateTime(dt)) => Ok(Some(dt.to_chrono())),
            Some(DateTimeEither::String(s)) => {
                DateTime::parse_from_rfc3339(&s)
                    .map(|dt| Some(dt.with_timezone(&Utc)))
                    .or_else(|_| {
                        DateTime::parse_from_rfc2822(&s).map(|dt| Some(dt.with_timezone(&Utc)))
                    })
                    .map_err(serde::de::Error::custom)
            }
        }
    }

    pub fn serialize<S>(dt: &Option<DateTime<Utc>>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match dt {
            Some(dt) => dt.to_rfc3339().serialize(serializer),
            None => serializer.serialize_none(),
        }
    }
}
