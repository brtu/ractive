import { COMMENT, ELEMENT } from 'config/types';
import stripStandalones from './stripStandalones';
import trimWhitespace from './trimWhitespace';
import { isString } from 'utils/is';

const contiguousWhitespace = /[ \t\f\r\n]+/g;
const leadingWhitespace = /^[ \t\f\r\n]+/;
const trailingWhitespace = /[ \t\f\r\n]+$/;
const leadingNewLine = /^(?:\r\n|\r|\n)/;
const trailingNewLine = /(?:\r\n|\r|\n)$/;

export default function cleanup(
  items,
  stripComments,
  preserveWhitespace,
  removeLeadingWhitespace,
  removeTrailingWhitespace,
  whiteSpaceElements
) {
  if (isString(items)) return;

  let i,
    item,
    previousItem,
    nextItem,
    preserveWhitespaceInsideFragment,
    removeLeadingWhitespaceInsideFragment,
    removeTrailingWhitespaceInsideFragment;

  // First pass - remove standalones and comments etc
  stripStandalones(items);

  i = items.length;
  while (i--) {
    item = items[i];

    // Remove delimiter changes, unsafe elements etc
    if (item.exclude) {
      items.splice(i, 1);
    } else if (stripComments && item.t === COMMENT) {
      // Remove comments, unless we want to keep them
      items.splice(i, 1);
    }
  }

  // If necessary, remove leading and trailing whitespace
  trimWhitespace(
    items,
    removeLeadingWhitespace ? leadingWhitespace : null,
    removeTrailingWhitespace ? trailingWhitespace : null
  );

  i = items.length;
  while (i--) {
    item = items[i];

    // Recurse
    if (item.f) {
      const isPreserveWhitespaceElement =
        item.t === ELEMENT &&
        (whiteSpaceElements[item.e.toLowerCase()] || whiteSpaceElements[item.e]);
      preserveWhitespaceInsideFragment = preserveWhitespace || isPreserveWhitespaceElement;

      if (!preserveWhitespace && isPreserveWhitespaceElement) {
        trimWhitespace(item.f, leadingNewLine, trailingNewLine);
      }

      if (!preserveWhitespaceInsideFragment) {
        previousItem = items[i - 1];
        nextItem = items[i + 1];

        // if the previous item was a text item with trailing whitespace,
        // remove leading whitespace inside the fragment
        if (!previousItem || (isString(previousItem) && trailingWhitespace.test(previousItem))) {
          removeLeadingWhitespaceInsideFragment = true;
        }

        // and vice versa
        if (!nextItem || (isString(nextItem) && leadingWhitespace.test(nextItem))) {
          removeTrailingWhitespaceInsideFragment = true;
        }
      }

      cleanup(
        item.f,
        stripComments,
        preserveWhitespaceInsideFragment,
        removeLeadingWhitespaceInsideFragment,
        removeTrailingWhitespaceInsideFragment,
        whiteSpaceElements
      );
    }

    // Split if-else blocks into two (an if, and an unless)
    if (item.l) {
      cleanup(
        item.l,
        stripComments,
        preserveWhitespace,
        removeLeadingWhitespaceInsideFragment,
        removeTrailingWhitespaceInsideFragment,
        whiteSpaceElements
      );

      item.l.forEach(s => (s.l = 1));
      item.l.unshift(i + 1, 0);
      items.splice.apply(items, item.l);
      delete item.l; // TODO would be nice if there was a way around this
    }

    // Clean up conditional attributes
    if (item.m) {
      cleanup(
        item.m,
        stripComments,
        preserveWhitespace,
        removeLeadingWhitespaceInsideFragment,
        removeTrailingWhitespaceInsideFragment,
        whiteSpaceElements
      );
      if (item.m.length < 1) delete item.m;
    }
  }

  // final pass - fuse text nodes together
  i = items.length;
  while (i--) {
    if (isString(items[i])) {
      if (isString(items[i + 1])) {
        items[i] = items[i] + items[i + 1];
        items.splice(i + 1, 1);
      }

      if (!preserveWhitespace) {
        items[i] = items[i].replace(contiguousWhitespace, ' ');
      }

      if (items[i] === '') {
        items.splice(i, 1);
      }
    }
  }
}
