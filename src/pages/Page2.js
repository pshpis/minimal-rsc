import fs from 'fs';
import {Title} from '../Title';

export function Page2() {
  const markdown = fs.readFileSync('notes/two.md', 'utf-8');
  return (
    <div>
      <h1>Page Two!</h1>
      <Title value="new_title2" />
      {markdown}
    </div>
  );
}
