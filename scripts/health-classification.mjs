export function transientSupplierFailure(detail) {
  return /signal timed out|service timeout|timed?\s*out|try again later|temporar(?:y|ily)|unavailable|overloaded|rate.?limit|fetch failed|network error|connection reset|request failed|do request failed|upstream error|\b429\b|\b(?:api|http(?: status)?)\s*5\d\d\b|upstream\s+5\d\d|上游\s*5\d\d/i.test(String(detail || ''))
}
