select
  routes.id,
  routes.name,
  routes.description,
  routes.user_id,
  routes.created_at,
  routes.updated_at
from routes
where routes.user_id = ${user_id}
