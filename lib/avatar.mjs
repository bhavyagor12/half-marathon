// Feet-relative coordinates calibrated against public/models/bhavya.glb.
export const AVATAR_HEIGHT = 3.9 * .65;
export const AVATAR_GROUND = .23;
// x, height above soles, decal width, decal height, front(+1)/back(-1)
// Order matches SPOTS: chest, left chest, right chest, left forearm, right forearm, upper back, lower back, left quad, butt.
// Forearm and quad centres come from probing the model's skin texture, so the stickers sit on the limb, not over its edge.
export const AVATAR_ANCHORS = [
  [0, 2.60, .52, .25, 1], [-.22, 2.98, .25, .16, 1], [.22, 2.98, .25, .16, 1],
  [-.58, 2.12, .18, .36, 1], [.58, 2.14, .18, .36, 1],
  [0, 2.92, .50, .24, -1], [0, 2.36, .50, .24, -1],
  [-.28, 1.16, .24, .28, 1],
  [0, 1.77, .48, .22, -1],
].map(([x, y, width, height, side]) => [x * .65, y * .65, width * .65, height * .65, side]);
