import { Link } from 'react-router-dom';
import { categoryHref } from '../utils/urls.js';

export default function Kicker({ category }) {
  return <Link to={categoryHref(category)} className="kicker">{category.name}</Link>;
}
