import { useEffect, useRef } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, highlightSpecialChars, rectangularSelection, crosshairCursor, dropCursor } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap, type CompletionContext } from '@codemirror/autocomplete';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { json } from '@codemirror/lang-json';
import { tags as t } from '@lezer/highlight';

const theme = EditorView.theme(
  {
    '&': { height: '100%', backgroundColor: '#0B0C10', color: '#E8EAF0', fontSize: '13px' },
    '.cm-scroller': { fontFamily: '"JetBrains Mono", ui-monospace, monospace', lineHeight: '1.6' },
    '.cm-content': { caretColor: '#22D3EE', padding: '8px 0' },
    '.cm-cursor': { borderLeftColor: '#22D3EE', borderLeftWidth: '2px' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: '#2E2766 !important' },
    '.cm-gutters': { backgroundColor: '#0E0F14', color: '#4C5263', border: 'none', borderRight: '1px solid #1C1F28' },
    '.cm-activeLineGutter': { backgroundColor: '#14161D', color: '#A3A9B8' },
    '.cm-activeLine': { backgroundColor: '#12141A' },
    '.cm-matchingBracket': { backgroundColor: '#2B2550', outline: '1px solid #6B4EFF' },
    '.cm-selectionMatch': { backgroundColor: '#1E2A3A' },
    '.cm-foldGutter span': { color: '#4C5263' },
    '.cm-tooltip': { backgroundColor: '#1A1D25', border: '1px solid #2E3342', color: '#E8EAF0' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#2B2550', color: '#fff' },
    '.cm-panels': { backgroundColor: '#13151B', color: '#E8EAF0', borderBottom: '1px solid #1F222B' },
    '.cm-panels input, .cm-panels button': { fontSize: '12px' },
    '.cm-textfield': { backgroundColor: '#0F1015', border: '1px solid #2A2E3A', color: '#E8EAF0' },
    '.cm-button': { backgroundImage: 'none', backgroundColor: '#1C1F28', border: '1px solid #2E3342', color: '#E8EAF0' },
    '.cm-searchMatch': { backgroundColor: '#3A2F0E' },
    '.cm-searchMatch-selected': { backgroundColor: '#5C4A12' },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: '#C792EA' },
  { tag: [t.definitionKeyword, t.modifier], color: '#C792EA' },
  { tag: [t.string, t.special(t.string)], color: '#A5E07A' },
  { tag: [t.number, t.bool, t.null], color: '#F78C6C' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#5C6680', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#82AAFF' },
  { tag: [t.className, t.typeName, t.definition(t.className)], color: '#FFCB6B' },
  { tag: t.propertyName, color: '#89DDFF' },
  { tag: [t.variableName], color: '#E8EAF0' },
  { tag: [t.definition(t.variableName)], color: '#F0F2F8' },
  { tag: t.self, color: '#FF5CA8' },
  { tag: [t.operator, t.punctuation, t.bracket], color: '#9AA1B2' },
]);

/** Suggestions for the `degamed` library. Kept short; full API docs live in the docs site. */
const API = [
  { label: 'Behaviour', type: 'class', info: 'Base class for scripts' },
  { label: 'Input', type: 'namespace', info: 'Keyboard and touch input' },
  { label: 'Input.axis', type: 'function', info: "Input.axis('horizontal') → -1, 0 or 1" },
  { label: 'Input.isDown', type: 'function', info: "Input.isDown('jump') — held right now" },
  { label: 'Input.isPressed', type: 'function', info: "Input.isPressed('jump') — pressed this frame" },
  { label: 'Game', type: 'namespace', info: 'Score, logging and game state' },
  { label: 'Game.log', type: 'function', info: 'Print to the Console' },
  { label: 'Game.score', type: 'property' },
  { label: 'kit', type: 'namespace', info: 'Effects: tween, shake, burst, juice' },
  { label: 'kit.tween', type: 'function', info: 'kit.tween(entity, { alpha: 0 }, { duration: 400 })' },
  { label: 'this.entity', type: 'property', info: 'The entity this script is on' },
  { label: 'this.play', type: 'method', info: "this.play('run') — play an animation" },
  { label: 'this.playOnce', type: 'method', info: "this.playOnce('attack') — play once, then resume" },
  { label: 'onStart', type: 'method', info: 'Called once when the scene starts' },
  { label: 'onUpdate', type: 'method', info: 'Called every frame with dt in seconds' },
  { label: 'onCollide', type: 'method', info: 'Called when touching another entity' },
  { label: 'onAnimationEnd', type: 'method', info: 'Called when a one-shot animation finishes' },
];

function degamedCompletions(ctx: CompletionContext) {
  const word = ctx.matchBefore(/[\w.]+/);
  if (!word || (word.from === word.to && !ctx.explicit)) return null;
  return { from: word.from, options: API, validFor: /^[\w.]*$/ };
}

function languageFor(path: string) {
  if (path.endsWith('.py')) return python();
  if (path.endsWith('.json')) return json();
  return javascript();
}

/** A CodeMirror editor bound to one file. External changes (undo, AI edits) flow back in. */
export function CodeEditor({
  path,
  value,
  onChange,
  onCursor,
  readOnly,
}: {
  path: string;
  value: string;
  onChange: (text: string) => void;
  onCursor?: (line: number, col: number) => void;
  readOnly?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const cbs = useRef({ onChange, onCursor });
  cbs.current = { onChange, onCursor };
  const lang = useRef(new Compartment());

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          foldGutter(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion({ override: path.endsWith('.json') ? [] : [degamedCompletions] }),
          rectangularSelection(),
          crosshairCursor(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, indentWithTab]),
          lang.current.of(languageFor(path)),
          theme,
          syntaxHighlighting(highlight),
          EditorState.tabSize.of(2),
          EditorState.readOnly.of(!!readOnly),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) cbs.current.onChange(u.state.doc.toString());
            if (u.selectionSet || u.docChanged) {
              const head = u.state.selection.main.head;
              const line = u.state.doc.lineAt(head);
              cbs.current.onCursor?.(line.number, head - line.from + 1);
            }
          }),
          EditorView.contentAttributes.of({ 'aria-label': `Code editor: ${path}` }),
        ],
      }),
    });
    view.current = v;
    return () => v.destroy();
    // One editor per file: the parent keys this component by path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pull in changes made elsewhere (undo/redo, other panels).
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const cur = v.state.doc.toString();
    if (cur !== value) v.dispatch({ changes: { from: 0, to: cur.length, insert: value } });
  }, [value]);

  return <div ref={host} className="h-full min-h-0 overflow-hidden" />;
}
