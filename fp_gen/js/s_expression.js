/* Copyright (c) 2023 Benedikt Heinz <zn000h AT gmail.com>
 * Licensed under MIT (https://github.com/znuh/kicad-frontpanel-generator/blob/main/LICENSE)
 * You may also use the BSD 2-Clause License
 */

/* speed optimized S-expression parser
 * parsing a ~2.2MByte KiCad PCB takes 100-150ms on a not-too-old computer
 *
 * strings in the result will have quotes ("") around them
 * escape sequences in strings are kept as they are
 * simple trick to decode strings in the results: use JSON.parse()
 *
 * Example:
 * parse_sexpression('(test foo "bar 23")') -> ["test","foo","\\"bar 23\\""]
 */
function parse_sexpression(str) {
	let stack  = [];
	let list   = [];
	let idx    = 0;
	let escape = false;
	let string = false;

	for (let j = 0; j < str.length; j++) {
		const c  = str[j];
		if (escape) {            // escaped char
			list[idx] = (list[idx] ?? "") + c;
			escape    = false;
		}
		else if (c == "\\") {     // escape
			if (string)
				list[idx] = (list[idx] ?? "") + c;   // keep escape symbol in string
			escape = true;
		}
		else if (string) {       // char of string
			list[idx] = (list[idx] ?? "") + c;
			string    = (c != "\"");
		}
		else if (c.charCodeAt(0) <= 0x20) {  // whitespace outside of string
			if(list[idx] == undefined) continue;
			if((!Array.isArray(list[idx])) && (!isNaN(list[idx])))     // convert last token to number if possible
				list[idx]=+list[idx];
			idx++;
		}
		else {                   // non-whitespace, not char of string, not an escaped char
			switch(c) {
				case '(':        // start of new list
					stack.push(list);
					idx      += (list[idx] != undefined);    // treat questionable expression '(a b(c d))' as if it were '(a b (c d))'
					list[idx] = [];
					list      = list[idx];
					idx       = 0;
					break;
				case ')':        // end of list
					if((!Array.isArray(list[idx])) && (!isNaN(list[idx])))     // convert last token to number if possible
						list[idx]=+list[idx];
					list = stack.pop();
					idx  = list.length;
					break;
				case '"':        // start of string
					string = true;   // no break here - keep strings enclosed in "" - payload (including unescape) can be extracted with JSON.parse()
				default:         // regular char
					list[idx] = (list[idx] ?? "") + c;
			}
		}
	}
	if (stack.length)
		throw new Error('S-Expression parse error');
	return list[0];
}
