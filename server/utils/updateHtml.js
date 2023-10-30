function getHtmlWithUpdatedTitle(html, newTitle) {
  let titleBegin = html.lastIndexOf('<title>') + 7;
  let titleEnd = html.lastIndexOf('</title>');
  let title = html.slice(titleBegin, titleEnd);
  let htmlBeforeTitle = html.slice(0, html.lastIndexOf('<title>'));
  let htmlAfterTitle = html.slice(html.lastIndexOf('<title>'));
  htmlAfterTitle = htmlAfterTitle.replace(title, newTitle);
  return htmlBeforeTitle + htmlAfterTitle;
}

module.exports = {
  getHtmlWithUpdatedTitle,
};
