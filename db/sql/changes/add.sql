INSERT INTO changes (
  description, location_id, observation_id, user_id,
  location, review
)
VALUES (
  ${description}, ${location_id}, ${review_id}, ${user_id},
  ${location:json}, ${review:json}
)
