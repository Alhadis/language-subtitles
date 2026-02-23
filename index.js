"use strict";

const {name} = require("./package.json");
let disposables = null;
let indexPrompt = null;
let timePrompt  = null;


module.exports = {
	WEBVTT_EDITOR: 'atom-text-editor[data-grammar="text vtt"]:not([mini])',
	SUBRIP_EDITOR: 'atom-text-editor[data-grammar="text srt"]:not([mini])',
	SRT_REGEX: xe`
		(?:\A\uFEFF? | (?:\R[ \t]*){2})
		(?<![ \t]) (?<index>\d+) \R
		(?<start>\d{2}(?::\d{2}){2},\d{3})\ -->\ (?<end>\d{2}(?::\d{2}){2},\d{3}) [ \t]*
		(?<text>(?:\R.*\S.*)*)`,


	/**
	 * Activate package and register editor commands.
	 * @api private
	 */
	activate(){
		const PromptView = require("prompt-view");
		if(null == indexPrompt)
			indexPrompt = new PromptView({
				headerText: "Jump to a SubRip Text entry by number:",
				footerText: fold`
					Each subtitle entry in a SubRip Text file is numbered beginning from 1,
					although authors are not required to keep these numbers consistent, and
					many modern media players ignore them entirely.
				`,
				placeholder: "An integer greater than 0",
			});
		if(null == timePrompt){
			const HH = '<var><abbr title="Hours">HH</abbr></var>';
			const MM = '<var><abbr title="Minutes (0–59)">MM</abbr></var>';
			const SS = '<var><abbr title="Seconds (0–59)">SS</abbr></var>';
			timePrompt = new PromptView({
				headerText: "Jump to a subtitle by its timecode:",
				footerHTML: fold`
					Timecodes are specified in <samp>${HH}:${MM}:${SS}</samp> format,
					with all components except for ${SS} optional. Seconds may also be
					provided as singular values that specify a timecode in absolute units.
				`,
				placeholder: "HH:MM:SS.SSS",
			});
		}

		const {CompositeDisposable} = require("atom");
		disposables = new CompositeDisposable(
			atom.commands.add(`${this.WEBVTT_EDITOR}, ${this.SUBRIP_EDITOR}`, {
				[`${name}:go-to-timecode`]:     this.wrapMethodAsCommand(this.gotoTime),
			}),
			atom.commands.add(this.SUBRIP_EDITOR, {
				[`${name}:reindex-subtitles`]:  this.wrapMethodAsCommand(this.reindex),
				[`${name}:go-to-subrip-entry`]: this.wrapMethodAsCommand(this.gotoIndex),
			}),
		);
	},


	/**
	 * Deactivate package.
	 * @api private
	 */
	deactivate(){
		if(disposables){
			disposables.dispose();
			disposables = null;
		}
		indexPrompt = null;
		timePrompt  = null;
	},


	/**
	 * Jump to a SubRip Text entry by number.
	 *
	 * @example <caption>Programmatically jumping to subtitle #47</caption>
	 *    const pkg = atom.packages.activePackages["language-subtitles"].mainModule;
	 *    const editor = await atom.workspace.open("/tmp/Gladiator (2000).srt");
	 *    await pkg.gotoIndex(583, editor);
	 *
	 * @param {Number} index
	 *    Number of subtitle entry to jump to. Note that only the first index
	 *    is used in the event that a document contains duplicate indices.
	 *
	 * @param {Boolean|"index"} [select=false]
	 *    Hpw the subtitle entry should be selected in the buffer:
	 *    If `false`, the cursor is placed at the end of the entry's index-line.
	 *    If `true`, the entire entry is selected, including trailing newline.
	 *    If `"index"`, only the first line containing the index is selected.
	 *
	 * @param {TextEditor} [editor]
	 *    Defaults to the currently-active text-editor.
	 *
	 * @throws {RangeError} if `index` is NaN or an infinite value.
	 * @throws {TypeError} if an invalid `select` argument is passed.
	 * @return {Promise<Range|void>}
	 * @api public
	 */
	async gotoIndex(index, select = false, editor = atom.workspace.getActiveTextEditor()){
		// Allow selection-mode parameter to be omitted
		if(atom.workspace.isTextEditor(select))
			[select, editor] = [false, select];
		
		// Do nothing if we don't even have an editor to operate upon
		if(!atom.workspace.isTextEditor(editor)) return;
		
		// Raise an exception if we're called with an unsupported selection-mode
		if("boolean" !== typeof select && "string" === typeof select && "index" !== select)
			throw new TypeError(`Invalid selection mode: ${select}`);
		
		// Prompt user to provide index argument if we aren't running programmatically
		index ??= await indexPrompt.promptUser();
		if(null == index) return; // User cancelled
		if(!Number.isFinite(index = Number(index)))
			throw new RangeError("Index must be finite value");
		index = Math.round(Math.max(0, index));
		
		// Now start searching for a header-line with the desired index
		const regex = xe`(?:\A\uFEFF?|(?:\R[ \t]*){2}(?<![ \t]))${index}(?=\R)`;
		let range = await editor.buffer.find(regex);
		if(!range) return;
		range = editor.bufferRangeForBufferRow(range.end.row);
		switch(select){
			case false:
				range.start = range.end.copy();
				break;
			case true:
				range.end   = editor.buffer.getEndPosition();
				const Point = range.end.constructor;
				const blank = await editor.buffer.findInRange(/^[ \t]*$/m, range);
				range.end   = blank ? Point.fromObject(blank.start) : range.end;
				break;
		}
		editor.setSelectedBufferRange(range);
		editor.getLastCursor().autoscroll({center: true});
		return range;
	},


	/**
	 * Jump to a subtitle entry by its approximate timecode.
	 *
	 * @param {Number|String} time
	 * @param {TextEditor} [editor]
	 * @return {Promise<void>}
	 * @api public
	 */
	async gotoTime(time, editor = atom.workspace.getActiveTextEditor()){
		if(!atom.workspace.isTextEditor(editor)) return;
		time ??= await timePrompt.promptUser();
		if(null == time) return;
		time = this.parseTimecode(time);
	},


	/**
	 * Reenumerate the indices of a SubRip Text file.
	 * Useful when entries have been added or deleted.
	 *
	 * @param {TextEditor} [editor]
	 * @return {void}
	 * @api public
	 */
	reindex(editor = atom.workspace.getActiveTextEditor()){
		if(!atom.workspace.isTextEditor(editor)) return;
		let i = 0;
		const text = editor.getText();
		editor.setText(text.replace(/(?<=^\uFEFF?|\r?\n\r?\n)\d+(?=\r?\n)/g, () => ++i));
	},


	/**
	 * Extract a list of subtitle objects from SubRip Text source.
	 *
	 * @param {TextEditor} [editor]
	 * @return {SRTSubtitle}
	 * @api public
	 */
	parseSubtitles(editor = atom.workspace.getActiveTextEditor()){
		if(!atom.workspace.isTextEditor(editor))
			throw new TypeError("Invalid text-editor instance");
		const grammar = editor?.getGrammar();
		if("text.srt" !== grammar?.scopeName)
			throw new TypeError(`Invalid grammar in-use: ${grammar.name}`);
		
		const results = [];
		const regex = this.SRT_REGEX;
		try{
			const text = editor.getText();
			let result;
			regex.lastIndex = 0;
			while(result = regex.exec(text)){
				const start = result.index;
				const end   = start + result[0].length;
				const {groups} = result;
				results.push({
					index: +groups.index,
					start: this.parseTimecode(groups.start),
					end:   this.parseTimecode(groups.end),
					text:  groups.text.trim().replaceAll(/\r\n|\r(?!\n)/g, "\n"),
				});
				regex.lastIndex = start + end;
			}
		}
		catch(e){ console.error(e); }
		finally{ regex.lastIndex = 0; }
		return results;
	},


	/**
	 * Convert an “HH:MM:SS”-format timecode into a number of seconds.
	 *
	 * @example parseTimecode("01:32:54.200") === 5574.2;
	 * @param {String|Number} input
	 * @return {Number}
	 * @api private
	 */
	parseTimecode(input){
		// Treat singular values as a number of seconds
		if(Number(input))
			return Number(input);

		input = `${input}`.trim().replaceAll(",", ".");
		if(input.includes(";") && !input.includes(":"))
			input = input.replaceAll(";", ":");

		input = input.split(":").reverse();
		const seconds = parseFloat(input.shift());
		const minutes = (parseInt(input.shift()) || 0) * 60;
		const hours   = (parseInt(input.shift()) || 0) * 3600;
		return seconds + minutes + hours;
	},


	/**
	 * Return a copy of a method that replaces {@link TextEditor}-type
	 * arguments with the actual target of a dispatched command event.
	 *
	 * @param {Function} method
	 *    A reference to a method defined by this object, called in its context,
	 *    with references to {@link TextEditor} objects in the arguments list
	 *    substituted for the actual recipiet of the command-event.
	 * @param {Function} [aborter=null]
	 *    A callback function used to abort the keybinding event and allow other
	 *    commands to respond to the original keyboard event.
	 * @param {Object} [context=this]
	 * @return {Function}
	 * @api private
	 */
	wrapMethodAsCommand(method, aborter = null, context = this){
		return (event, ...args) => {
			if("function" === typeof aborter && aborter(event, ...args))
				return event.abortKeyBinding();
			const editor = event instanceof CustomEvent
				? event?.currentTarget?.getModel() ?? atom.workspace.getActiveTextEditor()
				: atom.workspace.isTextEditor(event)
					? event
					: atom.workspace.getActiveTextEditor();
			const {length} = args;
			if(editor) for(let i = 0; i < length; ++i)
				if(atom.workspace.isTextEditor(args[i]))
					args[i] = editor;
			return method.apply(context, args);
		};
	},
};


// Make read-only any properties of the main-module that quack like constants
for(const key in module.exports)
	if(/^(?!\d)[A-Z0-9]{3,}(?:_[A-Z0-9]+)*$/.test(key))
		Object.defineProperty(module.exports, key, {
			writable:     false,
			configurable: false,
			enumerable:   true,
		});


/**
 * Create a regular expression from extended, readable multiline source.
 * @param {String} src
 * @return {RegExp}
 * @pubiic
 */
function xe(...args){
	return new RegExp(String.raw(...args)
		.replaceAll("[ ", "[\\x20")
		.replace(/((?:^|(?<!\\))(?:\\{2})*)\\(A|R|\s)/gm, (_, leadIn, esc) => {
			switch(esc){
				case "A":  esc = "^(?<!\\n|\\r)";   break;
				case "R":  esc = "(?:\\r?\\n|\\r)"; break;
				case " ":  esc = "\\x20";           break;
				case "\t": esc = "\\t";             break;
				case "\f": esc = "\\f";             break;
			}
			return leadIn + esc;
		}).replace(/\s+/g, ""));
}


/**
 * Strip indentation and hard-wrapping from an indented paragraph.
 * @param {String} text
 * @private
 */
function fold(...args){
	return String.raw(...args).trim().replace(/\s+/g, " ");
}
