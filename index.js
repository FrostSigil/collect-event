module.exports = function collectreward(mod) {

	mod.game.initialize("inventory");
	
	const voucher = [155780];
	const playTime = {};
	let playTimeRew = {};
	let lasttimemoved = Date.now();
	let contract = null;
	let contractType = null;
	let timer1 = null;
	let timer2 = null;
	let timer3 = null;

	if (mod.majorPatchVersion >= 92) {
		[
			"C_RECEIVE_PLAYTIME_EVENT_REWARD",
			"C_GET_WARE_ITEM"
		].forEach(name =>
			mod.dispatch.addOpcode(name, mod.dispatch.connection.metadata.maps.protocol[name], true)
		);
	}

	mod.dispatch.addDefinition("C_REQUEST_CONTRACT", 50, [
		["name", "refString"],
		["data", "refBytes"],
		["type", "int32"],
		["target", "int64"],
		["value", "int32"],
		["name", "string"],
		["data", "bytes"]
	]);
	
	mod.dispatch.addDefinition("C_GET_WARE_ITEM", 4, [
		["gameId", "int64"],
		["container", "int32"],
		["offset", "int32"],
		["money", "int64"],
		["fromSlot", "int32"],
		["dbid", "uint64"],
		["id", "int32"],
		["amount", "int32"],
		["unk1", "int32"],
		["unk2", "int32"]
	]);

	mod.hook("S_REQUEST_CONTRACT", 1, e => {
		contract = e.id;
		contractType = e.type;
	});

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
		mod.setTimeout(() => checkPlayTime(), 2000);
		clearTimeout(timer1);
		timer1 = setTimeout(() => {
			mod.send("C_REQUEST_PLAYTIME", 1, {});
		}, 5 * 60 * 1000 + 5000);
	});

	function checkPlayTime() {
		const vip = mod.game.inventory.bagItems.find(x => voucher.includes(x.id));
		if (vip && mod.game.inventory.findAllInBagOrPockets(vip.id).length !== 0) {
			sViewWareEx(vip);
		}
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

	function sViewWareEx(itemtobank) {
		if (mod.game.me.inCombat) return;
		openBank();
		const hooks = mod.hookOnce("S_VIEW_WARE_EX", "*", event => {
			mod.unhook(hooks);
			let freeSlotFound = false;
			for (let i = 0; i < 72; i++) {
				if (!event.items.some(item => item.slot === i + event.offset)) {
					freeSlotFound = true;
				}
			}
			if (freeSlotFound) {
				mod.setTimeout(() =>
					bankItem(event.container, event.offset, itemtobank, 1), 50);
			} else if (event.offset + 72 < event.numUnlockedSlots) {
				mod.setTimeout(() => bankTabChange(event.container, event.offset), 25);
			} else {
				cCancelContract();
				mod.log("ERROR: No left space in bank.");
			}
		});
	}

	function openBank() {
		const buffer = Buffer.alloc(4);
		buffer.writeUInt32LE(1);
		mod.send("C_REQUEST_CONTRACT", 50, {
			type: 26,
			target: "0",
			value: 1,
			name: "",
			data: buffer
		});
	}
	
	function bankItem(container, offset, item, amount) {
		const hooks = mod.hookOnce("S_VIEW_WARE_EX", "*", () => {
			mod.unhook(hooks);
			cCancelContract();
			mod.log("Placed the item in the bank.");
		});

		mod.send("C_PUT_WARE_ITEM", 4, {
			gameId: mod.game.me.gameId,
			container: container,
			offset: offset,
			fromPocket: item.pocket,
			fromSlot: item.slot,
			id: item.id,
			dbid: item.dbid,
			amount: amount,
			toSlot: offset
		});
	}

	function bankTabChange(container, offset) {
		mod.send("C_VIEW_WARE", 2, {
			gameId: mod.game.me.gameId,
			type: container,
			offset: offset + 72
		});
	}

	function cCancelContract() {
		mod.send("C_CANCEL_CONTRACT", 1, {
			type: contractType,
			id: contract
		});
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