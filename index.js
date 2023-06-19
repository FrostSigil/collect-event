module.exports = function collectreward(mod) {

	const playTime = {};
	let playTimeRew = {};
	let lasttimemoved = Date.now();
	let timer1 = null;
	let timer2 = null;
	let timer3 = null;

	if (mod.majorPatchVersion >= 92) {
		[
			"C_RECEIVE_PLAYTIME_EVENT_REWARD"
		].forEach(name =>
			mod.dispatch.addOpcode(name, mod.dispatch.connection.metadata.maps.protocol[name], true)
		);
	}

	mod.hook("C_PLAYER_LOCATION", 5, event => {
		if (mod.dispatch.headless) return;
		if ([0, 1, 5, 6].indexOf(event.type) > -1)
			lasttimemoved = Date.now();
	});

	mod.hook("C_RETURN_TO_LOBBY", "raw", () => {
		if (mod.dispatch.headless) return;
		if (Date.now() - lasttimemoved >= 3600000) return false;
	});

	mod.hook("S_PLAYTIME_EVENT_REWARD_DATA", 1, event => {
		playTimeRew = event;
		mod.setTimeout(() => checkPlayTime(event), 2000);
		clearTimeout(timer1);
		timer1 = setTimeout(() => {
			mod.send("C_REQUEST_PLAYTIME", 1, {});
		}, 5 * 60 * 1000 + 5000);
	});

	function checkPlayTime() {
		if (playTimeRew && playTimeRew.items && Array.isArray(playTimeRew.items)) {
			playTimeRew.items.forEach((item, index) => {
				const row = item.row;
				const column = item.column;
				const redeemed = item.redeemed;
				const redeemable = item.redeemable;

				if (redeemed === 0 && redeemable === 1) {
					playTime[`${row}-${column}`] = redeemed;

					mod.setTimeout(() => {
						sendPlayTime(row, column);
					}, (index + 1) * 1000);
				}
			});
		}
	}

	function sendPlayTime(row, column) {
		mod.send("C_RECEIVE_PLAYTIME_EVENT_REWARD", 1, {
			row,
			column
		});
		if (row === 2 && column === 6) {
			mod.command.message("Collected all 6 rewards per day");
		}
		if (row === 2) {
			mod.command.message(`I take the award line 1, cell ${column}`);
		} else if (row === 1) {
			mod.command.message(`I take the award line 2, cell ${column}`);
		}
		setDelayInterval(row);
	}

	function setDelayInterval(row) {
		if (row === 2) {
			clearTimeout(timer2);
			timer2 = setTimeout(() => {
				mod.send("C_REQUEST_PLAYTIME", 1, {});
			}, 30 * 60 * 1000 + 5000);
		} else if (row === 1) {
			clearTimeout(timer3);
			timer3 = setTimeout(() => {
				mod.send("C_REQUEST_PLAYTIME", 1, {});
			}, 5 * 60 * 60 * 1000 + 5000);
		}
	}
};