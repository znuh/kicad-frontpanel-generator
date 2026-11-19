/* Copyright (c) 2026 Benedikt Heinz <zn000h AT gmail.com>
 * Licensed under MIT (https://github.com/znuh/kicad-frontpanel-generator/blob/main/LICENSE)
 */

function fileReader(e, loader) {
	const file = e.target.files[0];
	if (!file) return;
	let reader = new FileReader();
	reader.onload = evt => loader(evt.target.result, file.name);
	reader.readAsText(file);
}

async function file_download(din, parms) {
	const blobby = new Blob([din], {type: parms.type});

	if (window.showSaveFilePicker != null) {
		const fileHandle = await window.showSaveFilePicker({
			startIn: 'desktop',
			suggestedName: parms.fname,
			types: [{
				description: parms.desc,
				/* '_' in extension isn't allowed, so we cannot pass ".kicad_pcb" here.
				 * Using emtpy extensions array instead and relying on suggestedName. */
				accept: { [parms.type]: parms.ext ? [parms.ext] : [] },
			}],
		});
		const fileStream = await fileHandle.createWritable();
		await fileStream.write(blobby);
		await fileStream.close();
	} else { // window.showSaveFilePicker not available
		const    a = document.createElement("a");
		a.href     = window.URL.createObjectURL(blobby);
		a.download = parms.fname;
		a.click();
		URL.revokeObjectURL(a.href);
	}
}

function SVG_has_masks(SVG) {
	/* We simply look for a group which is a direct child of the SVG that's
	 * active (display!=none) and has a rect child with a mask set. */
	const groups = SVG.querySelectorAll(':scope > g');
	return Array.from(groups).some( g => {
		const active = g.getAttribute('display') !== 'none';
		return active && !!g.querySelector('rect[mask]');
	});
}

function show_container(div, show) {
	if (show)
		document.getElementById(div).classList.remove('d-none');
	else
		document.getElementById(div).classList.add('d-none');
}

const container_hidden = (div) => document.getElementById(div).classList.contains('d-none');
