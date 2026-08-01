// A lightweight initials-avatar — no photo upload/storage needed, just a
// deterministic color + initials derived from the user's name so the same
// person always gets the same look.
const AVATAR_COLORS = ['#a8611c', '#14453f', '#2e6b47', '#a23b2a', '#3f9c8c', '#5b4b8a', '#1c6ea4', '#8a4b6b'];

const getInitials = (name) => {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  const initials = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return initials.toUpperCase();
};

const getColor = (name) => {
  const str = name || '';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const Avatar = ({ name, size = 56 }) => (
  <div
    className="avatar-circle"
    style={{ width: size, height: size, fontSize: Math.round(size * 0.4), background: getColor(name) }}
    aria-hidden="true"
  >
    {getInitials(name)}
  </div>
);

export default Avatar;
