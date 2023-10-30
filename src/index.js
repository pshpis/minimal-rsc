import {createRoot} from 'react-dom/client';
import {Router} from './router';

const root = createRoot(document.getElementById('root'));
// get page for router from window.location.href
console.log('Location: ', window.location.href);
root.render(<Router startLocation={window.location.href} />);
