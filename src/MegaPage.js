import {Page1} from './pages/Page1';
import {Page2} from './pages/Page2';
import {Page3} from './pages/Page3';

export default async function MegaPage({page}) {
  if (page === 'Page1') {
    return <Page1 />;
  }
  if (page === 'Page2') {
    return <Page2 />;
  }
  if (page === 'Page3') {
    return <Page3 />;
  }

  return <h1>None</h1>;
}
