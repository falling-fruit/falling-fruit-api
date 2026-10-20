const _ = {}

function weighted_mean(values, weights) {
  const [value, weight] = values
    .map((value, i) => [value, weights[i]])
    .reduce(([value_sum, weight_sum], [value, weight]) => {
      return [value_sum + value * weight, weight_sum + weight]
    }, [0, 0])
  return value / weight
}

_.move_cluster = function({cx, cy}, n, {x, y}, add) {
  return {
    x: weighted_mean([cx, x], [n, add]),
    y: weighted_mean([cy, y], [n, add])
  }
}

module.exports = _
