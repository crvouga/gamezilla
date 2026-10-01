import { Fragment, type Node } from 'prosemirror-model';

export function safeMarkdownHref(href: string) {
  return /^(https?:\/\/|mailto:|#|\/)/i.test(href) && !href.startsWith('//');
}
export function cleanMarkdownNode(node: Node): Node {
  const marks = node.marks.filter(
    (mark) =>
      mark.type.name !== 'link' || safeMarkdownHref(String(mark.attrs['href']))
  );
  if (node.isText) return node.mark(marks);
  if (
    node.type.name === 'image' &&
    !safeMarkdownHref(String(node.attrs['src']))
  )
    return node.type.schema.text(String(node.attrs['alt'] ?? 'Image'));
  const children: Node[] = [];
  node.content.forEach((child) => children.push(cleanMarkdownNode(child)));
  return node.copy(Fragment.from(children)).mark(marks);
}
