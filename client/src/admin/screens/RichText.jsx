import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import './RichText.css';

const SAFE_HREF = /^(https?:\/\/|mailto:|\/|#)/i;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TABLE = '<table><thead><tr><th>Heading</th><th>Heading</th><th>Heading</th></tr></thead><tbody>' + '<tr><td>Cell</td><td>Cell</td><td>Cell</td></tr>'.repeat(2) + '</tbody></table><p><br></p>';

// A dependency-free rich-text field built on contentEditable. Whatever it produces is sanitised again on the server
// (allowlist), so the HTML here is never trusted. Pasting is forced to plain text to avoid importing stray formatting.
const RichText = forwardRef(function RichText({ initialHtml, resetKey, onChange, onPickImage }, ref) {
  const el = useRef(null);
  const emit = () => onChange(el.current.innerHTML);
  useEffect(() => { if (el.current) el.current.innerHTML = initialHtml || ''; }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const exec = (cmd, val) => { el.current.focus(); document.execCommand(cmd, false, val); emit(); }; // eslint-disable-line
  useImperativeHandle(ref, () => ({
    insertHtml(html) { el.current.focus(); document.execCommand('insertHTML', false, html); emit(); },
    insertImage(img) {
      const dims = img.width && img.height ? ` width="${img.width}" height="${img.height}"` : '';
      this.insertHtml(`<figure><img src="${esc(img.url)}" alt="${esc(img.alt || '')}"${dims}>${img.caption || img.credit ? `<figcaption>${esc(img.caption || '')}${img.credit ? ` Credit: ${esc(img.credit)}` : ''}</figcaption>` : ''}</figure><p><br></p>`);
    },
    insertLink(url, text) { this.insertHtml(`<a href="${esc(url)}">${esc(text)}</a>`); },
  }));

  function link() {
    const url = window.prompt('Link address (https://…, mailto:… or /article/…)');
    if (!url) return;
    if (!SAFE_HREF.test(url.trim())) { window.alert('Links must start with https://, http://, mailto: or /'); return; }
    exec('createLink', url.trim());
  }
  const B = ({ label, children, onClick, wide }) => <button type="button" className={`rte__btn${wide ? ' rte__btn--wide' : ''}`} aria-label={label} title={label} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{children}</button>;

  return (
    <div className="rte">
      <div className="rte__bar" role="toolbar" aria-label="Formatting">
        <B label="Paragraph" onClick={() => exec('formatBlock', 'p')} wide>¶</B>
        <B label="Heading 2" onClick={() => exec('formatBlock', 'h2')} wide>H2</B>
        <B label="Heading 3" onClick={() => exec('formatBlock', 'h3')} wide>H3</B>
        <span className="rte__sep" aria-hidden="true" />
        <B label="Bold" onClick={() => exec('bold')}><b>B</b></B>
        <B label="Italic" onClick={() => exec('italic')}><i>I</i></B>
        <B label="Bulleted list" onClick={() => exec('insertUnorderedList')} wide>• List</B>
        <B label="Numbered list" onClick={() => exec('insertOrderedList')} wide>1. List</B>
        <B label="Quote" onClick={() => exec('formatBlock', 'blockquote')} wide>Quote</B>
        <span className="rte__sep" aria-hidden="true" />
        <B label="Add link" onClick={link} wide>Link</B>
        <B label="Remove link" onClick={() => exec('unlink')} wide>Unlink</B>
        <B label="Insert image" onClick={onPickImage} wide>Image</B>
        <B label="Insert table" onClick={() => exec('insertHTML', TABLE)} wide>Table</B>
        <span className="rte__sep" aria-hidden="true" />
        <B label="Clear formatting" onClick={() => exec('removeFormat')} wide>Clear</B>
        <B label="Undo" onClick={() => exec('undo')} wide>Undo</B>
        <B label="Redo" onClick={() => exec('redo')} wide>Redo</B>
      </div>
      <div ref={el} className="rte__body prose" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Article body" spellCheck
        onInput={emit} onBlur={emit}
        onPaste={(e) => { e.preventDefault(); const t = e.clipboardData.getData('text/plain'); document.execCommand('insertText', false, t); }} />
    </div>
  );
});
export default RichText;
