/**
 * 时序图分析扩展
 */
import * as extensionConfig from '../extension.json';

let isSelecting = false;
let pollTimer: any = null;
let isAnalyzing = false;

let selectedComponents: any[] = [];

const _latestTimingData: { svg: string; info: string } | null = null;

let g_formData: any = null;
let _g_pads1: any[] = [];
let _g_pads2: any[] = [];
let _g_commonNets: string[] = [];
let _g_compData: any = {};
const _g_servicesRegistered = false;
let _g_netViaCounts: { [key: string]: number } = {};

async function getNetViaCounts(nets: string[]): Promise<{ [key: string]: number }> {
	try {
		console.warn('[Timing] Getting all vias...');
		const allVias = await eda.pcb_PrimitiveVia.getAll();
		if (!allVias || allVias.length === 0) {
			console.warn('[Timing] No vias found');
			return {};
		}

		console.warn('[Timing] Total vias found:', allVias.length);

		const viaCounts: { [key: string]: number } = {};
		for (const via of allVias) {
			try {
				const netName = via.getState_Net?.();
				if (netName && nets.includes(netName)) {
					viaCounts[netName] = (viaCounts[netName] || 0) + 1;
				}
			}
			catch {}
		}

		console.warn('[Timing] Net via counts:', JSON.stringify(viaCounts));
		return viaCounts;
	}
	catch (e) {
		console.warn('[Timing] Error getting via counts:', e);
		return {};
	}
}

async function unhighlightAllNets(): Promise<void> {
	try {
		console.warn('[Timing] unhighlightAllNets function called');
		const docInfo = await eda.dmt_SelectControl.getCurrentDocumentInfo();
		if (!docInfo || docInfo.documentType !== 3) {
			console.warn('[Timing] No PCB document');
			return;
		}

		let netsToUnhighlight: string[] = [];

		if (g_formData?.commonNets) {
			const commonNets = g_formData.commonNets || [];
			const powerNets = ['GND', '3V3', '5V', 'VCC', 'VDD', 'AVDD', 'DVDD', 'AGND', 'DGND', 'VSS', '12V', '24V', '1V8', '2V5', '1V2', '1V5', '1V0'];
			const signalNets = commonNets.filter((net: any) => {
				const netUpper = String(net?.net || net).toUpperCase();
				return !powerNets.some(pn => netUpper === pn || netUpper.startsWith(`${pn}_`) || netUpper.endsWith(`_${pn}`));
			});
			netsToUnhighlight = signalNets.map((net: any) => net?.net || net);
		}
		else if (g_formData?.nets) {
			netsToUnhighlight = g_formData.nets;
		}

		console.warn('[Timing] Nets to unhighlight:', netsToUnhighlight);

		for (const netName of netsToUnhighlight) {
			if (netName) {
				try {
					await eda.pcb_Net.unhighlightNet(netName);
					console.warn('[Timing] Unhighlighted:', netName);
				}
				catch (e) {
					console.error('[Timing] Failed to unhighlight:', netName, e);
				}
			}
		}
	}
	catch (e) {
		console.error('[Timing] unhighlightAllNets error:', e);
	}
}

export function activate(_status?: 'onStartupFinished', _arg?: string): void {
	setTimeout(() => {
		eda.sys_MessageBus.rpcServicePublic('getTimingFormData', () => {
			if (g_formData && g_formData.info && g_formData.nets && g_formData.nets.length > 0) {
				return JSON.parse(JSON.stringify(g_formData));
			}
			return { info: 'Data not ready', nets: [] };
		});
	}, 1000);

	eda.sys_MessageBus.subscribePublic('requestTimingFormData', () => {
		if (g_formData && g_formData.info && g_formData.nets && g_formData.nets.length > 0) {
			eda.sys_MessageBus.publishPublic('timingFormData', JSON.parse(JSON.stringify(g_formData)));
		}
		else {
			eda.sys_MessageBus.publishPublic('timingFormData', { info: 'Data not ready', nets: [] });
		}
	});

	eda.sys_MessageBus.subscribePublic('unhighlightAllNets', async () => {
		try {
			console.warn('[Timing] unhighlightAllNets received, g_formData:', g_formData);
			const docInfo = await eda.dmt_SelectControl.getCurrentDocumentInfo();
			if (!docInfo || docInfo.documentType !== 3) {
				console.warn('[Timing] No PCB document');
				return;
			}

			let netsToUnhighlight: string[] = [];

			if (g_formData?.commonNets) {
				const commonNets = g_formData.commonNets || [];
				const powerNets = ['GND', '3V3', '5V', 'VCC', 'VDD', 'AVDD', 'DVDD', 'AGND', 'DGND', 'VSS', '12V', '24V', '1V8', '2V5', '1V2', '1V5', '1V0'];
				const signalNets = commonNets.filter((net: any) => {
					const netUpper = String(net?.net || net).toUpperCase();
					return !powerNets.some(pn => netUpper === pn || netUpper.startsWith(`${pn}_`) || netUpper.endsWith(`_${pn}`));
				});
				netsToUnhighlight = signalNets.map((net: any) => net?.net || net);
			}
			else if (g_formData?.nets) {
				netsToUnhighlight = g_formData.nets;
			}

			console.warn('[Timing] Nets to unhighlight:', netsToUnhighlight);

			for (const netName of netsToUnhighlight) {
				if (netName) {
					try {
						await eda.pcb_Net.unhighlightNet(netName);
						console.warn('[Timing] Unhighlighted:', netName);
					}
					catch (e) {
						console.warn('[Timing] Failed to unhighlight:', netName, e);
					}
				}
			}
		}
		catch (e) {
			console.warn('[Timing] unhighlightAllNets error:', e);
		}
	});

	// 临时网络高亮功能 - 来自iframe的鼠标悬停事件
	eda.sys_MessageBus.subscribePublic('highlightNetRequest', async (netName: string) => {
		try {
			if (netName) {
				await eda.pcb_Net.highlightNet(netName);
			}
		}
		catch (e) {
			// 忽略单个网络高亮错误，避免频繁事件导致的问题
			console.warn('[Timing] Failed to highlight net temporarily:', netName, e);
		}
	});

	eda.sys_MessageBus.subscribePublic('unhighlightNetRequest', async (netName: string) => {
		try {
			if (netName) {
				await eda.pcb_Net.unhighlightNet(netName);
			}
		}
		catch (e) {
			// 忽略单个网络取消高亮错误
			console.warn('[Timing] Failed to unhighlight net temporarily:', netName, e);
		}
	});
}

export function about(): void {
	eda.sys_Dialog.showInformationMessage(
		eda.sys_I18n.text('时序图分析扩展 v${1}', undefined, undefined, extensionConfig.version),
		eda.sys_I18n.text('关于'),
	);
}

export function changeTheme(): void {
	try {
		eda.sys_IFrame.closeIFrame('themeSelector');
	}
	catch {}

	eda.sys_IFrame.openIFrame('/iframe/theme.html', 400, 250, 'themeSelector', {
		title: eda.sys_I18n.text('选择界面主题'),
		hideHeader: false,
		maximizeButton: false,
		minimizeButton: false,
	});
}

export async function testCapture(): Promise<void> {
	try {
		const docInfo = await eda.dmt_SelectControl.getCurrentDocumentInfo();
		if (!docInfo || docInfo.documentType !== 3) {
			eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('请先打开一个PCB文档'), eda.sys_I18n.text('提示'));
			return;
		}

		const selectedPrimitives = await eda.pcb_SelectControl.getAllSelectedPrimitives();
		if (!selectedPrimitives || selectedPrimitives.length < 2) {
			eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('请先选择两个器件'), eda.sys_I18n.text('提示'));
			return;
		}

		const allComps = await eda.pcb_PrimitiveComponent.getAll();
		const selectedIds: string[] = [];
		for (const p of selectedPrimitives) {
			if (p && typeof p.getState_PrimitiveId === 'function') {
				selectedIds.push(p.getState_PrimitiveId());
			}
		}
		const compIds = allComps.map((c: any) => c.getState_PrimitiveId?.()).filter(Boolean);
		const selectedCompIds = selectedIds.filter((id: string) => compIds.includes(id));

		if (selectedCompIds.length < 2) {
			eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('请选择两个器件'), eda.sys_I18n.text('提示'));
			return;
		}

		const comp1 = allComps.find((c: any) => c.getState_PrimitiveId?.() === selectedCompIds[0]);
		const comp2 = allComps.find((c: any) => c.getState_PrimitiveId?.() === selectedCompIds[1]);

		if (!comp1 || !comp2) {
			eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('无法获取器件信息'), eda.sys_I18n.text('错误'));
			return;
		}

		let info = '=== Component 1 ===\n';
		info += `Designator: ${comp1.getState_Designator?.() || 'N/A'}\n`;
		info += `Name: ${comp1.getState_Name?.() || 'N/A'}\n`;

		try {
			const rawComp1 = selectedPrimitives.find((p: any) => p.getState_Designator?.() === comp1.getState_Designator?.());
			if (rawComp1) {
				info += `Raw - designator: ${(rawComp1 as any).designator}\n`;
				info += `Raw - name: ${(rawComp1 as any).name}\n`;
				info += `Raw - otherProperty: ${JSON.stringify((rawComp1 as any).otherProperty || {})}\n`;
				info += `Raw - primitiveId: ${(rawComp1 as any).primitiveId}\n`;
				info += `Raw - x: ${(rawComp1 as any).x}\n`;
				info += `Raw - y: ${(rawComp1 as any).y}\n`;
				info += `Raw - rotation: ${(rawComp1 as any).rotation}\n`;
				info += `Raw - layer: ${(rawComp1 as any).layer}\n`;
				info += `Raw - footprint: ${JSON.stringify((rawComp1 as any).footprint)}\n`;
				info += `Raw - component: ${JSON.stringify((rawComp1 as any).component)}\n`;
				info += `Raw - manufacturer: ${(rawComp1 as any).manufacturer}\n`;
				info += `Raw - supplier: ${(rawComp1 as any).supplier}\n`;
				info += `Raw - pads: ${JSON.stringify((rawComp1 as any).pads || [])}\n`;
				info += `Raw - uniqueId: ${(rawComp1 as any).uniqueId}\n`;
			}
		}
		catch {}

		info += '\n=== Component 2 ===\n';
		info += `Designator: ${comp2.getState_Designator?.() || 'N/A'}\n`;
		info += `Name: ${comp2.getState_Name?.() || 'N/A'}\n`;

		try {
			const rawComp2 = selectedPrimitives.find((p: any) => p.getState_Designator?.() === comp2.getState_Designator?.());
			if (rawComp2) {
				info += `Raw - designator: ${(rawComp2 as any).designator}\n`;
				info += `Raw - name: ${(rawComp2 as any).name}\n`;
				info += `Raw - otherProperty: ${JSON.stringify((rawComp2 as any).otherProperty || {})}\n`;
				info += `Raw - primitiveId: ${(rawComp2 as any).primitiveId}\n`;
				info += `Raw - x: ${(rawComp2 as any).x}\n`;
				info += `Raw - y: ${(rawComp2 as any).y}\n`;
				info += `Raw - rotation: ${(rawComp2 as any).rotation}\n`;
				info += `Raw - layer: ${(rawComp2 as any).layer}\n`;
				info += `Raw - footprint: ${JSON.stringify((rawComp2 as any).footprint)}\n`;
				info += `Raw - component: ${JSON.stringify((rawComp2 as any).component)}\n`;
				info += `Raw - manufacturer: ${(rawComp2 as any).manufacturer}\n`;
				info += `Raw - supplier: ${(rawComp2 as any).supplier}\n`;
				info += `Raw - pads: ${JSON.stringify((rawComp2 as any).pads || [])}\n`;
				info += `Raw - uniqueId: ${(rawComp2 as any).uniqueId}\n`;
			}
		}
		catch {}
		info += `IsFixed: ${comp2.getState_IsFixed?.() || 'N/A'}\n`;
		info += `IsPlaced: ${comp2.getState_IsPlaced?.() || 'N/A'}\n`;
		info += `IsLocked: ${comp2.getState_IsLocked?.() || 'N/A'}\n`;
		info += `IsMirror: ${comp2.getState_IsMirror?.() || 'N/A'}\n`;
		info += `IsBoardOut: ${comp2.getState_IsBoardOut?.() || 'N/A'}\n`;
		info += `Surface: ${comp2.getState_Surface?.() || 'N/A'}\n`;
		info += `3DModel: ${comp2.getState_Model?.() || 'N/A'}\n`;
		info += `ComponentDef: ${comp2.getState_ComponentDef?.() || 'N/A'}\n`;
		info += `SymbolId: ${comp2.getState_SymbolId?.() || 'N/A'}\n`;
		info += `SchematicId: ${comp2.getState_SchematicId?.() || 'N/A'}\n`;
		info += `Datasheet: ${comp2.getState_Datasheet?.() || 'N/A'}\n`;
		info += `Supplier: ${comp2.getState_Supplier?.() || 'N/A'}\n`;
		info += `SupplierPartNumber: ${comp2.getState_SupplierPartNumber?.() || 'N/A'}\n`;
		info += `RoHS: ${comp2.getState_RoHS?.() || 'N/A'}\n`;
		info += `LeadFree: ${comp2.getState_LeadFree?.() || 'N/A'}\n`;
		info += `MSL: ${comp2.getState_MSL?.() || 'N/A'}\n`;
		info += `RefDes: ${comp2.getState_RefDes?.() || 'N/A'}\n`;
		info += `AltPartNumber: ${comp2.getState_AltPartNumber?.() || 'N/A'}\n`;
		info += `PartNumber2: ${comp2.getState_PartNumber2?.() || 'N/A'}\n`;
		info += `Manufacturer2: ${comp2.getState_Manufacturer2?.() || 'N/A'}\n`;
		info += `Rating: ${comp2.getState_Rating?.() || 'N/A'}\n`;
		info += `Certifications: ${comp2.getState_Certifications?.() || 'N/A'}\n`;
		info += `Stock: ${comp2.getState_Stock?.() || 'N/A'}\n`;
		info += `Price: ${comp2.getState_Price?.() || 'N/A'}\n`;
		info += `Image: ${comp2.getState_Image?.() || 'N/A'}\n`;
		info += `Thumb: ${comp2.getState_Thumb?.() || 'N/A'}\n`;
		info += `Pins: ${JSON.stringify(comp2.getState_Pins?.() || [])}\n`;

		eda.sys_Dialog.showInformationMessage(info, 'Captured Component Info');
	}
	catch (error: any) {
		eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('错误: ${1}', undefined, undefined, error), eda.sys_I18n.text('错误'));
	}
}

export async function highlightNets(): Promise<void> {
	try {
		const docInfo = await eda.dmt_SelectControl.getCurrentDocumentInfo();
		if (!docInfo || docInfo.documentType !== 3) {
			eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('请先打开一个PCB文档'), eda.sys_I18n.text('提示'));
			return;
		}

		const selectedPrimitives = await eda.pcb_SelectControl.getAllSelectedPrimitives();
		if (!selectedPrimitives || selectedPrimitives.length < 2) {
			eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('请先选择两个器件'), eda.sys_I18n.text('提示'));
			return;
		}

		const allComps = await eda.pcb_PrimitiveComponent.getAll();
		const selectedIds: string[] = [];
		for (const p of selectedPrimitives) {
			if (p && typeof p.getState_PrimitiveId === 'function') {
				selectedIds.push(p.getState_PrimitiveId());
			}
		}
		const compIds = allComps.map((c: any) => c.getState_PrimitiveId?.()).filter(Boolean);
		const selectedCompIds = selectedIds.filter((id: string) => compIds.includes(id));

		if (selectedCompIds.length < 2) {
			eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('请选择两个器件'), eda.sys_I18n.text('提示'));
			return;
		}

		const comp1 = allComps.find((c: any) => c.getState_PrimitiveId?.() === selectedCompIds[0]);
		const comp2 = allComps.find((c: any) => c.getState_PrimitiveId?.() === selectedCompIds[1]);

		if (!comp1 || !comp2) {
			eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('无法获取器件信息'), eda.sys_I18n.text('错误'));
			return;
		}

		const pads1 = comp1.getState_Pads?.() || [];
		const pads2 = comp2.getState_Pads?.() || [];

		const nets1 = new Set(pads1.map((p: any) => p.net).filter((n: any) => n));
		const nets2 = new Set(pads2.map((p: any) => p.net).filter((n: any) => n));
		const commonNets = Array.from(nets1).filter((net: any) => nets2.has(net));

		if (commonNets.length === 0) {
			eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('两个器件之间没有共有的网络'), eda.sys_I18n.text('提示'));
			return;
		}

		const powerNets = ['GND', '3V3', '5V', 'VCC', 'VDD', 'AVDD', 'DVDD', 'AGND', 'DGND', 'VSS', '12V', '24V', '1V8', '2V5', '1V2', '1V5', '1V0'];
		const signalNets = commonNets.filter((net: any) => {
			const netUpper = String(net).toUpperCase();
			return !powerNets.some(pn => netUpper === pn || netUpper.startsWith(`${pn}_`) || netUpper.endsWith(`_${pn}`));
		});

		if (signalNets.length === 0) {
			eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('两个器件之间没有信号网络（仅有电源网络）'), eda.sys_I18n.text('提示'));
			return;
		}

		for (const net of signalNets) {
			try {
				await eda.pcb_Net.highlightNet(net);
			}
			catch {}
		}

		eda.sys_Message.showToastMessage(eda.sys_I18n.text('已高亮 ${1} 个信号网络', undefined, undefined, signalNets.length));
	}
	catch (error: any) {
		eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('错误: ${1}', undefined, undefined, error), eda.sys_I18n.text('错误'));
	}
}

export function test(): void {
	eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('扩展已正常加载！'), eda.sys_I18n.text('测试'));
}

function stopPolling(): void {
	isSelecting = false;
	if (pollTimer) {
		clearInterval(pollTimer);
		pollTimer = null;
	}
}

export async function analyzeTiming(): Promise<void> {
	eda.sys_Message.showToastMessage(eda.sys_I18n.text('请选择第一个器件'));

	try {
		const docInfo = await eda.dmt_SelectControl.getCurrentDocumentInfo();
		if (!docInfo || docInfo.documentType !== 3) {
			eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('请先打开一个PCB文档'), eda.sys_I18n.text('提示'));
			return;
		}

		stopPolling();
		selectedComponents = [];
		isSelecting = true;

		pollTimer = setInterval(async () => {
			if (!isSelecting) {
				stopPolling();
				return;
			}

			try {
				const selectedPrimitives = await eda.pcb_SelectControl.getAllSelectedPrimitives();

				if (!selectedPrimitives || !Array.isArray(selectedPrimitives) || selectedPrimitives.length === 0) {
					if (selectedComponents.length > 0) {
						eda.sys_Message.showToastMessage(eda.sys_I18n.text('选择已清除，请重新选择第一个器件'));
						selectedComponents = [];
					}
					return;
				}

				const selectedIds: string[] = [];
				for (const p of selectedPrimitives) {
					if (p && typeof p.getState_PrimitiveId === 'function') {
						selectedIds.push(p.getState_PrimitiveId());
					}
				}

				const allComps = await eda.pcb_PrimitiveComponent.getAll();
				if (!allComps || !Array.isArray(allComps)) {
					return;
				}

				const compIds = allComps.map((c: any) => c.getState_PrimitiveId?.()).filter(Boolean);
				const selectedCompIds = selectedIds.filter((id: string) => compIds.includes(id));

				if (selectedCompIds.length >= 2) {
					const comp1 = allComps.find((c: any) => c.getState_PrimitiveId?.() === selectedCompIds[0]);
					const comp2 = allComps.find((c: any) => c.getState_PrimitiveId?.() === selectedCompIds[1]);

					if (comp1 && comp2) {
						const des1 = comp1.getState_Designator?.() || 'U1';
						const des2 = comp2.getState_Designator?.() || 'U2';

						eda.sys_Message.showToastMessage(eda.sys_I18n.text('选中: ${1}, ${2}', undefined, undefined, des1, des2));
						stopPolling();

						await prepareFormData([comp1, comp2]);
					}
					return;
				}

				if (selectedCompIds.length === 1) {
					const comp = allComps.find((c: any) => c.getState_PrimitiveId?.() === selectedCompIds[0]);

					if (comp) {
						const des = comp.getState_Designator?.() || 'U?';

						if (selectedComponents.length === 0) {
							selectedComponents[0] = comp;
							eda.sys_Message.showToastMessage(eda.sys_I18n.text('已选: ${1}，请再选第二个器件', undefined, undefined, des));
						}
						else if (selectedComponents.length >= 1) {
							const firstId = selectedComponents[0]?.getState_PrimitiveId?.();
							const currentId = selectedCompIds[0];

							if (currentId !== firstId) {
								selectedComponents[1] = comp;
								const des1 = selectedComponents[0]?.getState_Designator?.() || 'U1';
								const des2 = des;

								eda.sys_Message.showToastMessage(eda.sys_I18n.text('选中: ${1}, ${2}', undefined, undefined, des1, des2));
								stopPolling();

								await prepareFormData(selectedComponents);
							}
						}
					}
				}
			}
			catch (error: any) {
				eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('错误: ${1}', undefined, undefined, error), eda.sys_I18n.text('错误'));
			}
		}, 300);
	}
	catch (error: any) {
		stopPolling();
		eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('分析出错: ${1}', undefined, undefined, error), eda.sys_I18n.text('错误'));
	}
}

async function prepareFormData(components: any[]): Promise<void> {
	if (isAnalyzing)
		return;

	isAnalyzing = true;

	try {
		const c1 = components[0];
		const c2 = components[1];

		if (!c1 || !c2) {
			eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('未选择2个器件'), eda.sys_I18n.text('错误'));
			isAnalyzing = false;
			return;
		}

		const des1 = c1.getState_Designator?.() || 'U1';
		const des2 = c2.getState_Designator?.() || 'U2';

		const otherProp1 = (c1 as any).otherProperty || {};
		const otherProp2 = (c2 as any).otherProperty || {};
		const device1 = otherProp1.Device || null;
		const device2 = otherProp2.Device || null;

		const mfr1 = c1.getState_Manufacturer?.();
		const mfr2 = c2.getState_Manufacturer?.();
		const name1 = c1.getState_Name?.();
		const name2 = c2.getState_Name?.();

		const devName1 = device1 || mfr1 || name1 || 'Unknown';
		const devName2 = device2 || mfr2 || name2 || 'Unknown';
		const x1 = c1.getState_X?.() || 0;
		const y1 = c1.getState_Y?.() || 0;
		const x2 = c2.getState_X?.() || 0;
		const y2 = c2.getState_Y?.() || 0;
		const pads1 = c1.getState_Pads?.() || [];
		const pads2 = c2.getState_Pads?.() || [];

		const nets1 = new Set(pads1.map((p: any) => p.net).filter((n: any) => n));
		const nets2 = new Set(pads2.map((p: any) => p.net).filter((n: any) => n));
		const commonNets = Array.from(nets1).filter((net: any) => nets2.has(net));

		if (commonNets.length === 0) {
			eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('两个器件之间没有共有的网络连接'), eda.sys_I18n.text('提示'));
			return;
		}

		const netOptions = commonNets.map((net: any) => {
			const pad1 = pads1.find((p: any) => p.net === net);
			const pad2 = pads2.find((p: any) => p.net === net);
			return `${net} (${des1}.${pad1?.padNumber} → ${des2}.${pad2?.padNumber})`;
		});

		const netLengths: { [key: string]: number } = {};
		const netViaCounts = await getNetViaCounts(commonNets);
		_g_netViaCounts = netViaCounts;

		console.warn('[Timing] Via counts per net:', netViaCounts);

		for (const net of commonNets) {
			try {
				const len = await eda.pcb_Net.getNetLength(net);
				if (len !== undefined && len > 0) {
					netLengths[net as string] = len as number;
				}
			}
			catch {}
		}

		g_formData = {
			info: `Source: ${des1} (${devName1})\nTarget: ${des2} (${devName2})\n${commonNets.length} common nets`,
			nets: netOptions,
			des1,
			des2,
			name1: devName1,
			name2: devName2,
			x1,
			y1,
			x2,
			y2,
			pads1,
			pads2,
			netLengths,
			netViaCounts,
			commonNets: commonNets.map((net: any) => {
				const pad1 = pads1.find((p: any) => p.net === net);
				const pad2 = pads2.find((p: any) => p.net === net);
				return { net, sourcePin: pad1?.padNumber, targetPin: pad2?.padNumber, viaCount: netViaCounts[net] || 0 };
			}),
		};
		_g_pads1 = [...pads1];
		_g_pads2 = [...pads2];
		_g_commonNets = commonNets.map((n: any) => String(n));
		_g_compData = { des1, des2, name1: devName1, name2: devName2, x1, y1, x2, y2 };

		try {
			eda.sys_IFrame.closeIFrame('timingForm');
		}
		catch {}

		await new Promise(resolve => setTimeout(resolve, 300));

		eda.sys_IFrame.openIFrame('/iframe/timing.html', 950, 600, 'timingForm', {
			title: eda.sys_I18n.text('时序图分析'),
			maximizeButton: false,
			minimizeButton: true,
			async buttonCallbackFn(button) {
				console.warn('[Timing] buttonCallbackFn triggered:', button);
				if (button === 'close') {
					console.warn('[Timing] Close button clicked, unhighlighting nets');
					await unhighlightAllNets();
				}
			},
			async onBeforeCloseCallFn() {
				console.warn('[Timing] onBeforeCloseCallFn triggered');
				await unhighlightAllNets();
				return true;
			},
		});

		eda.sys_Message.showToastMessage(eda.sys_I18n.text('正在打开时序分析...'));
		setTimeout(() => {
			if (g_formData && g_formData.info) {
				eda.sys_MessageBus.publishPublic('timingFormData', JSON.parse(JSON.stringify(g_formData)));
			}
		}, 2000);
		setTimeout(() => {
			if (g_formData && g_formData.info) {
				eda.sys_MessageBus.publishPublic('timingFormData', JSON.parse(JSON.stringify(g_formData)));
			}
		}, 3000);
	}
	catch (error) {
		eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('准备数据出错:\n${1}', undefined, undefined, error), eda.sys_I18n.text('错误'));
	}
	finally {
		isAnalyzing = false;
	}
}

export async function quickAnalysis(): Promise<void> {
	try {
		const docInfo = await eda.dmt_SelectControl.getCurrentDocumentInfo();
		if (!docInfo || docInfo.documentType !== 3) {
			eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('请先打开一个PCB文档'), eda.sys_I18n.text('提示'));
			return;
		}

		const allComponents = await eda.pcb_PrimitiveComponent.getAll();
		if (allComponents.length < 2) {
			eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('PCB上需要至少两个器件'), eda.sys_I18n.text('提示'));
			return;
		}

		let minDist = Infinity;
		let idx1 = 0;
		let idx2 = 1;

		for (let i = 0; i < allComponents.length; i++) {
			const x1 = allComponents[i].getState_X();
			const y1 = allComponents[i].getState_Y();
			for (let j = i + 1; j < allComponents.length; j++) {
				const x2 = allComponents[j].getState_X();
				const y2 = allComponents[j].getState_Y();
				const dist = Math.abs(x2 - x1) + Math.abs(y2 - y1);
				if (dist < minDist) {
					minDist = dist;
					idx1 = i;
					idx2 = j;
				}
			}
		}

		const ids = [
			allComponents[idx1].getState_PrimitiveId(),
			allComponents[idx2].getState_PrimitiveId(),
		];

		await eda.pcb_SelectControl.doSelectPrimitives(ids);
		await new Promise(resolve => setTimeout(resolve, 500));

		const selectedPrimitives = await eda.pcb_SelectControl.getAllSelectedPrimitives();
		const components = selectedPrimitives.filter((p: any) =>
			p && typeof p.getState_Designator === 'function',
		);
		if (components.length === 2) {
			await prepareFormData(components);
		}
	}
	catch (error) {
		eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('快速分析出错:\n${1}', undefined, undefined, error), eda.sys_I18n.text('错误'));
	}
}

export function cancelSelection(): void {
	stopPolling();
	selectedComponents = [];
	eda.sys_Message.showToastMessage(eda.sys_I18n.text('已取消选择'));
}

function _generateTimingSVG(
	params: {
		sourceDes: string;
		targetDes: string;
		sourcePin: string;
		targetPin: string;
		netName: string;
		clockFreqMHz: number;
		clockPeriodNS: number;
		setupTimeNS: number;
		holdTimeNS: number;
		propDelayNS: number;
		marginNS: number;
		manhattanDist: number;
		traceLength: number | null;
	},
): string {
	const width = 950;
	const height = 520;
	const leftMargin = 80;
	const rightMargin = 280;
	const availableWidth = width - leftMargin - rightMargin;

	const {
		sourceDes,
		targetDes,
		sourcePin,
		targetPin,
		netName,
		clockFreqMHz,
		clockPeriodNS,
		setupTimeNS,
		holdTimeNS,
		propDelayNS,
		marginNS,
		manhattanDist,
		traceLength,
	} = params;

	const displayPeriods = 1.5;
	const totalTimeNS = clockPeriodNS * displayPeriods;
	const timeScale = availableWidth / totalTimeNS;

	const clkY = 80;
	const dataOutY = 170;
	const dataInY = 280;
	const annotationY = 380;

	let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

	svg += `<rect width="${width}" height="${height}" fill="#1e1e1e"/>`;

	svg += `<text x="${width / 2}" y="25" text-anchor="middle" fill="#ffffff" font-family="Consolas, monospace" font-size="14" font-weight="bold">Timing Analysis: ${sourceDes}.${sourcePin} → ${targetDes}.${targetPin}</text>`;
	svg += `<text x="${width / 2}" y="42" text-anchor="middle" fill="#00aaff" font-family="Consolas, monospace" font-size="11">Net: ${netName || 'N/A'} | ${clockFreqMHz.toFixed(1)} MHz | Period: ${clockPeriodNS.toFixed(2)} ns</text>`;

	const timeAxisWidth = totalTimeNS * timeScale;
	const tickInterval = clockPeriodNS / 8;

	const timeAxisY = 30;
	svg += `<line x1="${leftMargin}" y1="${timeAxisY}" x2="${leftMargin + timeAxisWidth}" y2="${timeAxisY}" stroke="#666" stroke-width="1"/>`;
	for (let t = 0; t <= totalTimeNS; t += tickInterval) {
		const x = leftMargin + t * timeScale;
		const isMain = Math.abs(t % clockPeriodNS) < 0.01;
		const isSub = Math.abs(t % (clockPeriodNS / 2)) < 0.01;
		svg += `<line x1="${x}" y1="${isMain ? 20 : 22}" x2="${x}" y2="${timeAxisY + 3}" stroke="${isMain ? '#666' : '#888'}" stroke-width="${isMain ? 1 : 0.5}" data-orientation="vertical" data-original-width="${isMain ? 1 : 0.5}"/>`;
		if (isMain || isSub) {
			svg += `<g data-orientation="text" data-original-x="${x}"><text x="${x}" y="${timeAxisY + 15}" text-anchor="middle" fill="#666" font-family="Consolas, monospace" font-size="12" font-weight="bold">${t.toFixed(0)}ns</text></g>`;
		}
	}

	const gridEndY = 75 + (signalCount - 1) * 60 + 60;
	for (let t = 0; t <= totalTimeNS; t += tickInterval) {
		const x = leftMargin + t * timeScale;
		svg += `<line x1="${x}" y1="${timeAxisY}" x2="${x}" y2="${gridEndY}" stroke="#ccc" stroke-width="0.5" stroke-dasharray="3,3" data-orientation="vertical" data-original-width="0.5"/>`;
	}

	svg += `<text x="15" y="${clkY + 5}" fill="#ffcc00" font-family="Consolas, monospace" font-size="11">CLK</text>`;

	const halfPeriod = clockPeriodNS / 2 * timeScale;

	svg += `<line x1="${leftMargin}" y1="${clkY}" x2="${leftMargin + halfPeriod}" y2="${clkY}" stroke="#ffcc00" stroke-width="2"/>`;
	svg += `<line x1="${leftMargin + halfPeriod}" y1="${clkY}" x2="${leftMargin + halfPeriod}" y2="${clkY - 30}" stroke="#ffcc00" stroke-width="2"/>`;
	svg += `<line x1="${leftMargin + halfPeriod}" y1="${clkY - 30}" x2="${leftMargin + clockPeriodNS * timeScale}" y2="${clkY - 30}" stroke="#ffcc00" stroke-width="2"/>`;
	svg += `<line x1="${leftMargin + clockPeriodNS * timeScale}" y1="${clkY - 30}" x2="${leftMargin + clockPeriodNS * timeScale}" y2="${clkY}" stroke="#ffcc00" stroke-width="2"/>`;

	const base1 = leftMargin + clockPeriodNS * timeScale;
	svg += `<line x1="${base1}" y1="${clkY}" x2="${base1 + halfPeriod}" y2="${clkY}" stroke="#ffcc00" stroke-width="2"/>`;
	svg += `<line x1="${base1 + halfPeriod}" y1="${clkY}" x2="${base1 + halfPeriod}" y2="${clkY - 30}" stroke="#ffcc00" stroke-width="2"/>`;

	const launchX = leftMargin;
	const captureX = leftMargin + clockPeriodNS * timeScale;

	svg += `<line x1="${launchX}" y1="${clkY - 35}" x2="${launchX}" y2="${annotationY + 100}" stroke="#00ff88" stroke-width="1.5" stroke-dasharray="6,3"/>`;
	svg += `<polygon points="${launchX},${clkY - 35} ${launchX - 6},${clkY - 48} ${launchX + 6},${clkY - 48}" fill="#00ff88"/>`;
	svg += `<text x="${launchX}" y="${clkY - 55}" text-anchor="middle" fill="#00ff88" font-family="Consolas, monospace" font-size="10" font-weight="bold">Launch</text>`;

	svg += `<line x1="${captureX}" y1="${clkY - 35}" x2="${captureX}" y2="${annotationY + 100}" stroke="#ff6666" stroke-width="1.5" stroke-dasharray="6,3"/>`;
	svg += `<polygon points="${captureX},${clkY - 35} ${captureX - 6},${clkY - 48} ${captureX + 6},${clkY - 48}" fill="#ff6666"/>`;
	svg += `<text x="${captureX}" y="${clkY - 55}" text-anchor="middle" fill="#ff6666" font-family="Consolas, monospace" font-size="10" font-weight="bold">Capture</text>`;

	svg += `<text x="15" y="${dataOutY + 5}" fill="#00ff88" font-family="Consolas, monospace" font-size="11">DATA_OUT</text>`;

	const srcDelayNS = 0.5;
	const outChange1X = launchX + srcDelayNS * timeScale;
	const outChange2X = base1 + srcDelayNS * timeScale;

	svg += `<line x1="${leftMargin}" y1="${dataOutY}" x2="${outChange1X}" y2="${dataOutY}" stroke="#00ff88" stroke-width="2"/>`;
	svg += `<line x1="${outChange1X}" y1="${dataOutY}" x2="${outChange1X}" y2="${dataOutY - 25}" stroke="#00ff88" stroke-width="2"/>`;
	svg += `<line x1="${outChange1X}" y1="${dataOutY - 25}" x2="${outChange2X}" y2="${dataOutY - 25}" stroke="#00ff88" stroke-width="2"/>`;
	svg += `<line x1="${outChange2X}" y1="${dataOutY - 25}" x2="${outChange2X}" y2="${dataOutY}" stroke="#00ff88" stroke-width="2"/>`;
	svg += `<line x1="${outChange2X}" y1="${dataOutY}" x2="${leftMargin + timeAxisWidth}" y2="${dataOutY}" stroke="#00ff88" stroke-width="2"/>`;

	svg += `<text x="15" y="${dataInY + 5}" fill="#00aaff" font-family="Consolas, monospace" font-size="11">DATA_IN</text>`;

	const inChange1X = outChange1X + propDelayNS * timeScale;
	const inChange2X = outChange2X + propDelayNS * timeScale;

	svg += `<line x1="${leftMargin}" y1="${dataInY}" x2="${inChange1X}" y2="${dataInY}" stroke="#00aaff" stroke-width="2"/>`;
	svg += `<line x1="${inChange1X}" y1="${dataInY}" x2="${inChange1X}" y2="${dataInY - 25}" stroke="#00aaff" stroke-width="2"/>`;
	svg += `<line x1="${inChange1X}" y1="${dataInY - 25}" x2="${inChange2X}" y2="${dataInY - 25}" stroke="#00aaff" stroke-width="2"/>`;

	svg += `<circle cx="${captureX}" cy="${dataInY - 25}" r="5" fill="#ff6666" stroke="#fff" stroke-width="1"/>`;
	svg += `<text x="${captureX + 8}" y="${dataInY - 20}" fill="#ff6666" font-family="Consolas, monospace" font-size="9">Sample</text>`;

	svg += `<line x1="${inChange2X}" y1="${dataInY - 25}" x2="${inChange2X}" y2="${dataInY}" stroke="#00aaff" stroke-width="2"/>`;
	svg += `<line x1="${inChange2X}" y1="${dataInY}" x2="${leftMargin + timeAxisWidth}" y2="${dataInY}" stroke="#00aaff" stroke-width="2"/>`;

	svg += `<rect x="${captureX - setupTimeNS * timeScale}" y="${annotationY - 15}" width="${setupTimeNS * timeScale}" height="30" fill="rgba(255, 102, 102, 0.3)" stroke="#ff6666" stroke-width="1" data-orientation="box" data-original-width="1"/>`;
	svg += `<g data-orientation="text" data-original-x="${captureX - setupTimeNS * timeScale / 2}"><text x="${captureX - setupTimeNS * timeScale / 2}" y="${annotationY + 5}" text-anchor="middle" fill="#ff6666" font-family="Consolas, monospace" font-size="10" font-weight="bold">Setup</text></g>`;
	svg += `<g data-orientation="text" data-original-x="${captureX - setupTimeNS * timeScale / 2}"><text x="${captureX - setupTimeNS * timeScale / 2}" y="${annotationY + 18}" text-anchor="middle" fill="#ff6666" font-family="Consolas, monospace" font-size="9">Tsu=${setupTimeNS.toFixed(1)}ns</text></g>`;

	svg += `<rect x="${captureX}" y="${annotationY - 15}" width="${holdTimeNS * timeScale}" height="30" fill="rgba(102, 255, 102, 0.3)" stroke="#66ff66" stroke-width="1" data-orientation="box" data-original-width="1"/>`;
	svg += `<g data-orientation="text" data-original-x="${captureX + holdTimeNS * timeScale / 2}"><text x="${captureX + holdTimeNS * timeScale / 2}" y="${annotationY + 5}" text-anchor="middle" fill="#66ff66" font-family="Consolas, monospace" font-size="10" font-weight="bold">Hold</text></g>`;
	svg += `<g data-orientation="text" data-original-x="${captureX + holdTimeNS * timeScale / 2}"><text x="${captureX + holdTimeNS * timeScale / 2}" y="${annotationY + 18}" text-anchor="middle" fill="#66ff66" font-family="Consolas, monospace" font-size="9">Th=${holdTimeNS.toFixed(1)}ns</text></g>`;

	svg += `<rect x="${inChange1X}" y="${annotationY + 30}" width="${captureX - inChange1X}" height="25" fill="rgba(0, 170, 255, 0.3)" stroke="#00aaff" stroke-width="1" data-orientation="box" data-original-width="1"/>`;
	svg += `<g data-orientation="text" data-original-x="${(inChange1X + captureX) / 2}"><text x="${(inChange1X + captureX) / 2}" y="${annotationY + 48}" text-anchor="middle" fill="#00aaff" font-family="Consolas, monospace" font-size="9" font-weight="bold">Valid Data Window</text></g>`;

	const pdY = annotationY + 75;
	svg += `<line x1="${outChange1X}" y1="${pdY}" x2="${inChange1X}" y2="${pdY}" stroke="#ffaa00" stroke-width="2"/>`;
	svg += `<polygon points="${inChange1X},${pdY} ${inChange1X - 8},${pdY - 4} ${inChange1X - 8},${pdY + 4}" fill="#ffaa00"/>`;
	svg += `<g data-orientation="text" data-original-x="${(outChange1X + inChange1X) / 2}"><text x="${(outChange1X + inChange1X) / 2}" y="${pdY - 10}" text-anchor="middle" fill="#ffaa00" font-family="Consolas, monospace" font-size="11" font-weight="bold">Tpd = ${propDelayNS.toFixed(2)} ns</text></g>`;

	const infoX = width - 200;
	const infoY = 90;
	svg += `<rect x="${infoX - 10}" y="${infoY - 15}" width="190" height="200" fill="#2d2d2d" stroke="#555" rx="5" data-orientation="box" data-original-width="1"/>`;
	svg += `<g data-orientation="text" data-original-x="${infoX}"><text x="${infoX}" y="${infoY}" fill="#ffffff" font-family="Consolas, monospace" font-size="12" font-weight="bold">Timing Summary</text></g>`;
	svg += `<line x1="${infoX}" y1="${infoY + 8}" x2="${infoX + 170}" y2="${infoY + 8}" stroke="#555"/>`;
	svg += `<g data-orientation="text" data-original-x="${infoX}"><text x="${infoX}" y="${infoY + 28}" fill="#ffcc00" font-family="Consolas, monospace" font-size="11">Freq: ${clockFreqMHz.toFixed(1)} MHz</text></g>`;
	svg += `<g data-orientation="text" data-original-x="${infoX}"><text x="${infoX}" y="${infoY + 45}" fill="#ffcc00" font-family="Consolas, monospace" font-size="11">Period: ${clockPeriodNS.toFixed(2)} ns</text></g>`;
	svg += `<line x1="${infoX}" y1="${infoY + 53}" x2="${infoX + 170}" y2="${infoY + 53}" stroke="#555"/>`;
	svg += `<g data-orientation="text" data-original-x="${infoX}"><text x="${infoX}" y="${infoY + 72}" fill="#ff6666" font-family="Consolas, monospace" font-size="11">Tsu: ${setupTimeNS.toFixed(2)} ns</text></g>`;
	svg += `<g data-orientation="text" data-original-x="${infoX}"><text x="${infoX}" y="${infoY + 89}" fill="#66ff66" font-family="Consolas, monospace" font-size="11">Th: ${holdTimeNS.toFixed(2)} ns</text></g>`;
	svg += `<g data-orientation="text" data-original-x="${infoX}"><text x="${infoX}" y="${infoY + 106}" fill="#00aaff" font-family="Consolas, monospace" font-size="11">Tpd: ${propDelayNS.toFixed(2)} ns</text></g>`;
	svg += `<line x1="${infoX}" y1="${infoY + 114}" x2="${infoX + 170}" y2="${infoY + 114}" stroke="#555"/>`;
	svg += `<g data-orientation="text" data-original-x="${infoX}"><text x="${infoX}" y="${infoY + 135}" fill="${marginNS > 0 ? '#66ff66' : '#ff6666'}" font-family="Consolas, monospace" font-size="13" font-weight="bold">Margin: ${marginNS.toFixed(2)}ns</text></g>`;
	svg += `<g data-orientation="text" data-original-x="${infoX}"><text x="${infoX}" y="${infoY + 155}" fill="${marginNS > 0 ? '#66ff66' : '#ff6666'}" font-family="Consolas, monospace" font-size="14" font-weight="bold">${marginNS > 0 ? '✓ PASS' : '✗ FAIL'}</text></g>`;
	svg += `<g data-orientation="text" data-original-x="${infoX}"><text x="${infoX}" y="${infoY + 175}" fill="#888" font-family="Consolas, monospace" font-size="9">Dist: ${manhattanDist.toFixed(0)}mil${traceLength ? ` | Trace: ${traceLength.toFixed(0)}mil` : ''}</text></g>`;

	svg += `</svg>`;
	return svg;
}
