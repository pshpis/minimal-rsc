import fs from 'fs';

export function HeaderUpdater({headerName, headerValue}) {
  const headers = JSON.parse(
    fs.readFileSync('server/needHeaders.json', 'utf-8')
  );
  headers[headerName] = headerValue;
  fs.writeFileSync('server/needHeaders.json', JSON.stringify(headers));
  console.log(headers);
  return <></>;
}
