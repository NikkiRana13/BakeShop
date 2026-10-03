// Web-only stand-in for @react-native/assets-registry, which React Native
// 0.87 no longer installs. react-native-svg imports it only to look up images
// bundled inside SVGs; Pantry draws plain vector icons, so nothing is found.
export function getAssetByID() {
  return undefined;
}

export function registerAsset() {
  return 0;
}
