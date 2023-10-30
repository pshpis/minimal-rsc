import fs from 'fs';
import {Title} from '../Title';

export function Page1() {
  const markdown = fs.readFileSync('notes/one.md', 'utf-8');
  return (
    <div>
      <h1>Page One!</h1>
      <Title value="new_title1" />
      {markdown}
    </div>
  );
}
