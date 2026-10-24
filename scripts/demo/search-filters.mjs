// Arches search URL filters shared by the demo recording and the recap
// screenshots, so both show the same searches.

export const PERSON_GRAPH_ID = "22477f01-1a44-11e9-b0a9-000d3ab1e588";

// A strip about 180 m wide along Oxnard Street, standing in for a proposed
// utility corridor. Rancho Vega is the only inventoried resource it touches.
export const CORRIDOR = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: { buffer: { width: 0, unit: "m" }, inverted: false },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [-118.395, 34.1787],
                        [-118.335, 34.1787],
                        [-118.335, 34.1803],
                        [-118.395, 34.1803],
                        [-118.395, 34.1787],
                    ],
                ],
            },
        },
    ],
};

export const termFilter = (term) =>
    JSON.stringify([
        {
            type: "string",
            context: "",
            context_label: "",
            id: term,
            text: term,
            value: term,
            inverted: false,
        },
    ]);

// Only the Person record, so the map doesn't fly to "Paul Revere Williams
// House", a monument that isn't linked to him.
export const personFilter = JSON.stringify([
    { graphid: PERSON_GRAPH_ID, name: "Person", inverted: false },
]);

export const corridorSearchQuery = () =>
    new URLSearchParams({ "map-filter": JSON.stringify(CORRIDOR) });

export const ranchoVegaSearchQuery = () =>
    new URLSearchParams({ "term-filter": termFilter("Rancho Vega") });

export const williamsSearchQuery = () =>
    new URLSearchParams({
        "term-filter": termFilter("Paul Revere Williams"),
        "resource-type-filter": personFilter,
    });
