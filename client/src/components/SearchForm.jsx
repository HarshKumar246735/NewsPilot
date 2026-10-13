import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import './SearchForm.css';

// A real GET form to /search, so it works without JavaScript. With JS it navigates client-side.
export default function SearchForm({ initial = '', autoFocus = false, id = 'q' }) {
  const navigate = useNavigate();
  const submit = (e) => {
    const q = new FormData(e.currentTarget).get('q')?.toString().trim();
    e.preventDefault();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  };
  return (
    <form className="search-form" action="/search" method="get" role="search" onSubmit={submit}>
      <label className="sr-only" htmlFor={id}>Search articles</label>
      <input id={id} className="input search-form__input" type="search" name="q" defaultValue={initial}
        placeholder="Search articles" autoComplete="off" maxLength={100} data-autofocus={autoFocus ? '' : undefined} />
      <button className="btn btn--primary search-form__btn" type="submit"><Search size={18} aria-hidden="true" /> Search</button>
    </form>
  );
}
