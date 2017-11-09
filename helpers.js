var _ = {}

_.parse_muni = function(muni) {
  // 'true' or 'false'
  if (muni == 'false') {
    return 'IS FALSE';
  } else {
    return 'IS NOT NULL';
  }
}

_.parse_types = function(value) {
  // '1,2,3'
  if (value) {
    return 'IN (' + value.toString() + ')';
  } else {
    return 'IS NOT NULL';
  }
}
_.parse_bounds = function(value) {
  // 'wlng,elng,slat,nlat'
  value = value.split(",").map(x => parseFloat(x));
  xy = [[value[0], value[2]], [value[1], value[3]]]
    .map(x => _.clip_wgs84(x))
    .map(x => _.wgs84_to_web_mercator(x));
  return [
    "(x > " + xy[0][0] +
    (xy[1][0] > xy[0][0] ? " AND " : " OR ") +
    "x < " + xy[1][0] + ")",
    "y > " + xy[0][1],
    "y < " + xy[1][1]
  ].join(" AND ");
}

_.clip_wgs84 = function(lnglat) {
  const max_lat = 85.0;
  if (Math.abs(lnglat[1]) > max_lat) {
    lnglat[1] = max_lat * Math.sign(lnglat[1]);
  }
  return lnglat;
}

_.wgs84_to_web_mercator = function(lnglat) {
  const earth_radius = 6378137.0;
  const earth_circum = 2.0 * Math.PI * earth_radius;
  return [
    (lnglat[0] / 360) * earth_circum,
    Math.log(Math.tan((lnglat[1] + 90) * (Math.PI / 360))) * earth_radius
  ];
}

_.parse_locales = function(value) {
  if (value) {
    return value.split(",").map(x => x + "_name").join(",");
  } else {
    return "en_name";
  }
}

module.exports = _;
