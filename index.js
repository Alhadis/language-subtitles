"use strict";

const {name} = require("./package.json");
let disposables = null;


module.exports = {
	activate(){
		const {CompositeDisposable} = require("atom");
		disposables = new CompositeDisposable();
		disposables.add(
			atom.commands.add("atom-text-editor", `${name}:reindex-srt`, this.reindex.bind(this)),
		);
	},
	
	deactivate(){
		if(disposables){
			disposables.dispose();
			disposables = null;
		}
	},
	
	/**
	 * Reenumerate the indices of a SubRip Text file.
	 * Useful when entries have been added or deleted.
	 *
	 * @param {CustomEvent} event
	 * @return {void}
	 */
	reindex(event){
		const editor = event?.currentTarget?.getModel() ?? atom.workspace.getActiveTextEditor();
		if(atom.workspace.isTextEditor(editor)){
			let i = 0;
			const text = editor.getText();
			editor.setText(text.replace(/(?<=^\uFEFF?|\r?\n\r?\n)\d+(?=\r?\n)/g, () => ++i));
		}
	},
};
