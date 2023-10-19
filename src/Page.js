import fs from 'fs';
import { ClientMother } from "./ClientMother";

export default async function Page({page}) {
  if (page === 'one') {
    const markdown = fs.readFileSync('notes/one.md', 'utf-8');
    return (
      <div>
        <h1>Page One!</h1>
        {markdown}
      </div>
    );
  }
  if (page === 'two') {
    const markdown = fs.readFileSync('notes/two.md', 'utf-8');
    return (
      <div>
        <h1>Page Two!</h1>
        {markdown}
      </div>
    );
  }
  if (page === 'three') {
    const markdown = fs.readFileSync('notes/three.md', 'utf-8');
    await new Promise((res) => setTimeout(res, 2000));
    console.log('ss11',markdown)
    return (
      <div>
        <h1>Page Three! {markdown}</h1>
        <hr/>
        <ClientMother/>
      </div>
    );
  }

  return <h1>None</h1>;
}
