export const Point = JSON.parse(`
    {"type":"Point","coordinates":[1,1]}
`);

export const MultiPoint = JSON.parse(`
    {"type":"MultiPoint","coordinates":[[1,1],[2,2]]}
`);

export const LineString = JSON.parse(`
    {"type":"LineString","coordinates":[[0,0],[1,1],[2,2]]}
`);

export const MultiLineString = JSON.parse(`
    {"type":"MultiLineString","coordinates":[[[0,0],[1,1],[2,2]],[[0,0],[1,1],[2,2]]]}
`);

export const Polygon = JSON.parse(`
    {"type":"Polygon","coordinates":[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[5,5],[7,5],[7,7],[5,7],[5,5]]]}
`);

export const MultiPolygon = JSON.parse(`
    {"type":"MultiPolygon","coordinates":[[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[5,5],[7,5],[7,7],[5,7],[5,5]]],[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[5,5],[7,5],[7,7],[5,7],[5,5]]]]}
`);

export const Geometry = JSON.parse(`
    {"type":"Point","coordinates":[1,1]}
`);

export const GeometryCollection = JSON.parse(`
    {"type":"GeometryCollection","geometries":[{"type":"Point","coordinates":[1,1]},{"type":"LineString","coordinates":[[0,0],[1,1],[2,2],[3,3],[4,4]]}]}
`);


