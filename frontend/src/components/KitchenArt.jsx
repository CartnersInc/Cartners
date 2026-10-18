import ingredients from '../assets/kitchen-tote.webp';

export default function KitchenArt({ className = '' }) {
  return <img className={`kitchen-art ${className}`} src={ingredients} width="1536" height="1024" alt="" aria-hidden="true" decoding="sync" />;
}
