// Towns ashore (V7): everything placed in a port's harbor frame, a along
// the shore and o out to sea, metres from the port centre (WorldShape).
// Kettle Harbor gets a walkable town; the other ports a pier and a few
// buildings. Buildings face the sea (+o); their door is in the front wall.

export const TOWN_Y = 2.0; // made ground, quay and street level (m above still water)

// Made ground: terrain inside the rectangle is levelled to `height`,
// blending into the natural shore over `blend` metres.
export const TERRACES = {
  kettle: { a0: -134, a1: 94, o0: -112, o1: -22, blend: 16, height: 1.9 },
  station: { a0: -16, a1: 34, o0: -46, o1: -8, blend: 12, height: 1.9 },
};

// Kettle Harbor structures shared by the harbor meshes, colliders and the
// walkable layout.
export const KETTLE = {
  quay: { a0: -120, a1: 92, o0: -30, o1: -20, top: 2.0 },
  pier: { a: 35, o0: -24, o1: 75, width: 5, top: 1.8 },
  mole: [
    [-125, -20],
    [-125, 90],
    [-60, 135],
    [30, 150],
  ],
  moleCapTop: 2.8,
  crane: { a: -20, o: -24 },
  street: { a0: -130, a1: 92, o0: -46, o1: -30 }, // cobbles and pavements
  lane: { a0: -130, a1: 92, o0: -92, o1: -64 }, // gravel back lane and yards
  road: { a0: -134, a1: 94, o0: -104, o1: -94 }, // coastal road (tarmac)
  // Enterable buildings: centre (a, o), width w (along a), depth d, wall
  // height h. `opens` names the service panel behind the counter.
  buildings: [
    { id: 'harbormaster', name: 'Harbormaster', kind: 'office', a: -66, o: -54, w: 12, d: 11, h: 6.5, wall: 0xd9d4c6, roof: 'slate', opens: 'jobs' },
    { id: 'market', name: 'Fish market', kind: 'market', a: -42, o: -55, w: 16, d: 13, h: 5.2, wall: 0x9aa4a6, roof: 'metal', opens: 'fish' },
    { id: 'pub', name: 'The Kettle & Anchor', kind: 'pub', a: -17, o: -55, w: 14, d: 13, h: 7, wall: 0x7a3b2e, roof: 'slate', opens: 'pub' },
    { id: 'chandlery', name: 'Ross Chandlery', kind: 'shop', a: 4, o: -54, w: 10, d: 11, h: 6, wall: 0x3f5a66, roof: 'slate', opens: 'gear' },
    { id: 'shipyard', name: 'Kettle Shipyard', kind: 'office', a: 66, o: -55, w: 13, d: 12, h: 6.5, wall: 0xc9c2ae, roof: 'metal', opens: 'shipyard' },
    { id: 'home', name: 'Your house', kind: 'home', a: 26, o: -78, w: 9, d: 9, h: 6, wall: 0xe4ddcc, roof: 'slate', opens: 'home' },
  ],
  // Houses you can't enter (lit windows at night).
  houses: [
    { a: -80, o: -78, w: 10, d: 9, h: 6.5, wall: 0xe8e2d4 },
    { a: -62, o: -80, w: 8, d: 9, h: 6, wall: 0xb9c3c0 },
    { a: -44, o: -79, w: 11, d: 10, h: 7, wall: 0xd8cbb0 },
    { a: -24, o: -78, w: 9, d: 9, h: 6, wall: 0xe4ddcc },
    { a: -6, o: -80, w: 10, d: 9, h: 6.5, wall: 0x9fb0b5 },
    { a: 9, o: -78, w: 8, d: 8, h: 5.5, wall: 0xcdb99a },
    { a: 44, o: -79, w: 10, d: 10, h: 7, wall: 0xe8e2d4 },
    { a: 62, o: -78, w: 9, d: 9, h: 6, wall: 0xc4b8a4 },
    { a: 80, o: -80, w: 8, d: 9, h: 6, wall: 0xdad2c2 },
    { a: 36, o: -55, w: 7, d: 10, h: 6, wall: 0xb9c3c0 },
    { a: 88, o: -55, w: 6, d: 9, h: 5.5, wall: 0xe4ddcc },
  ],
  // Fuel kiosk on the pier head (enterable).
  kiosk: { id: 'kiosk', name: 'Fuel kiosk', kind: 'kiosk', a: 35, o: 62, w: 3.2, d: 3.4, h: 2.6, wall: 0xd9d6cc, roof: 'flat', opens: 'fuel', doorSide: -1 },
  streetLights: { o: -31, spacing: 18, a0: -124, a1: 90 },
  parked: [
    [-88, -41, 0],
    [-52, -41, 1],
    [-28, -41, 2],
    [18, -41, 3],
    [52, -41, 1],
    [78, -41, 0],
    [-70, -70, 2],
    [30, -68, 3],
  ],
};

// Small ports: a pier (existing) and three buildings on a levelled pad.
export const STATION = {
  pier: { a: 0, o0: -12, o1: 32, width: 4, top: 1.8 },
  pad: { a0: -14, a1: 32, o0: -42, o1: -10 },
  buildings: [
    { id: 'office', name: 'Harbour office', kind: 'office', a: 18, o: -30, w: 8, d: 9, h: 5.5, wall: 0xd9d4c6, roof: 'slate', opens: 'port' },
    { id: 'store', name: 'Store & café', kind: 'pub', a: 3, o: -32, w: 9, d: 8, h: 5, wall: 0x8a5a44, roof: 'slate', opens: 'pub' },
  ],
  houses: [{ a: -8, o: -34, w: 6, d: 7, h: 4.5, wall: 0xb9c3c0 }],
};
