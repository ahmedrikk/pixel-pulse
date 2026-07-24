export interface ProfileAsset {
  id: string;
  label: string;
  url: string;
}

export const PROFILE_AVATARS: ProfileAsset[] = [
  { id: "shark", label: "Cyber Shark", url: "/profile-assets/avatars/shark.png" },
  { id: "lady", label: "Arcade Hero", url: "/profile-assets/avatars/lady.png" },
  { id: "owl", label: "Night Owl", url: "/profile-assets/avatars/owl.png" },
  { id: "vr", label: "VR Voyager", url: "/profile-assets/avatars/vr.png" },
];

export const PROFILE_BANNERS: ProfileAsset[] = [
  { id: "cherry", label: "Cherry Garden", url: "/profile-assets/banners/cherry.jpg" },
  { id: "city", label: "Neon City", url: "/profile-assets/banners/city.jpg" },
  { id: "library", label: "Mystic Library", url: "/profile-assets/banners/library.jpg" },
  { id: "mountain", label: "Mountain Quest", url: "/profile-assets/banners/mountain.jpg" },
  { id: "night", label: "Starry Night", url: "/profile-assets/banners/night.jpg" },
  { id: "orb", label: "Magic Orb", url: "/profile-assets/banners/orb.jpg" },
  { id: "room", label: "Gamer Room", url: "/profile-assets/banners/room.jpg" },
  { id: "street", label: "Pixel Street", url: "/profile-assets/banners/street.jpg" },
  { id: "west", label: "Wild West", url: "/profile-assets/banners/west.jpg" },
];

