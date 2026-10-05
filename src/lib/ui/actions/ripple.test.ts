import { afterEach, describe, expect, it } from 'vitest';
import { motion } from '$lib/core/app/motion';
import { MOTION } from '$lib/core/theme';
import Ripple from './ripple';

function press() {
	const node = document.createElement('button');
	document.body.append(node);
	const action = Ripple(node);
	node.dispatchEvent(new PointerEvent('pointerdown', { clientX: 4, clientY: 4 }));
	return { node, action };
}

describe('Ripple', () => {
	afterEach(() => {
		motion.set(MOTION.base);
		document.body.replaceChildren();
	});

	it('spreads a ripple from the press', () => {
		const { node, action } = press();
		expect(node.querySelectorAll('span')).toHaveLength(1);
		action.destroy();
	});

	it('draws nothing while motion is reduced', () => {
		motion.set(0);
		const { node, action } = press();
		expect(node.children).toHaveLength(0);
		expect(node.style.overflow).toBe('');
		action.destroy();
	});
});
