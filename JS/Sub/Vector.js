// Simple 2D vector class
// NOTE: This file is not used in the current build (Script.js contains a Vec2 stub).
// Keep for future modularization.

export default class Vec2 {
	constructor(x = 0, y = 0) {
		this.x = x;
		this.y = y;
	}

	set(x, y) {
		this.x = x;
		this.y = y;
		return this;
	}

	add(v) {
		this.x += v.x;
		this.y += v.y;
		return this;
	}
}