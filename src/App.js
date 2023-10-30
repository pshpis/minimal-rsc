import {Suspense} from 'react';

import Nav from './components/client/Nav';
import MegaPage from './MegaPage';

export default function App({page}) {
  return (
    <div className="main">
      <Nav />
      <section key={page} className="col note-viewer">
        <Suspense fallback={<p>Loading...</p>}>
          <MegaPage page={page} />
        </Suspense>
      </section>
    </div>
  );
}
