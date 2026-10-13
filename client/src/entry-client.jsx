import { hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';

const initial = JSON.parse(document.getElementById('np-state').textContent);
hydrateRoot(document.getElementById('root'), (
  <BrowserRouter>
    <App initial={initial} />
  </BrowserRouter>
));
