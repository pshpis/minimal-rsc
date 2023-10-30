import fs from 'fs';
import {Title} from '../Title';
import {ClientMother} from '../components/client/ClientMother';

export async function Page3() {
  const markdown = fs.readFileSync('notes/three.md', 'utf-8');
  await new Promise((res) => setTimeout(res, 2000));
  return (
    <div>
      <h1>Page Three! {markdown}</h1>
      <hr />
      <ClientMother />
    </div>
  );
}
