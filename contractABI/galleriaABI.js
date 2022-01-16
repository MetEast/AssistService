module.exports = [
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "_operator",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "_from",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256[]",
				"name": "_ids",
				"type": "uint256[]"
			},
			{
				"indexed": false,
				"internalType": "uint256[]",
				"name": "_values",
				"type": "uint256[]"
			},
			{
				"indexed": false,
				"internalType": "bytes",
				"name": "_data",
				"type": "bytes"
			}
		],
		"name": "ERC1155BatchReceived",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "_operator",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "_from",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "_id",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "_value",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "bytes",
				"name": "_data",
				"type": "bytes"
			}
		],
		"name": "ERC1155Received",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "_user",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "_panelId",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "_tokenId",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "_amount",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "_fee",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "didUri",
				"type": "string"
			}
		],
		"name": "PanelCreated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "_user",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "_panelId",
				"type": "uint256"
			}
		],
		"name": "PanelRemoved",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_tokenId",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_amount",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "_didUri",
				"type": "string"
			}
		],
		"name": "createPanel",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256[]",
				"name": "_indexes",
				"type": "uint256[]"
			}
		],
		"name": "getAcitvePanelByIndexBatch",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "panelId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "panelState",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "userAddr",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "tokenId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "amount",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "fee",
						"type": "uint256"
					},
					{
						"internalType": "string",
						"name": "didUri",
						"type": "string"
					},
					{
						"internalType": "uint256",
						"name": "createTime",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "removeTime",
						"type": "uint256"
					}
				],
				"internalType": "struct IGalleria.PanelInfo[]",
				"name": "",
				"type": "tuple[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_index",
				"type": "uint256"
			}
		],
		"name": "getActivePanelByIndex",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "panelId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "panelState",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "userAddr",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "tokenId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "amount",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "fee",
						"type": "uint256"
					},
					{
						"internalType": "string",
						"name": "didUri",
						"type": "string"
					},
					{
						"internalType": "uint256",
						"name": "createTime",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "removeTime",
						"type": "uint256"
					}
				],
				"internalType": "struct IGalleria.PanelInfo",
				"name": "",
				"type": "tuple"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getActivePanelCount",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getCodeAddress",
		"outputs": [
			{
				"internalType": "address",
				"name": "_codeAddress",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getFeeParams",
		"outputs": [
			{
				"internalType": "address",
				"name": "_platformAddress",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_minFee",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getMagic",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "pure",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_panelId",
				"type": "uint256"
			}
		],
		"name": "getPanelById",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "panelId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "panelState",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "userAddr",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "tokenId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "amount",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "fee",
						"type": "uint256"
					},
					{
						"internalType": "string",
						"name": "didUri",
						"type": "string"
					},
					{
						"internalType": "uint256",
						"name": "createTime",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "removeTime",
						"type": "uint256"
					}
				],
				"internalType": "struct IGalleria.PanelInfo",
				"name": "",
				"type": "tuple"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256[]",
				"name": "_panelIds",
				"type": "uint256[]"
			}
		],
		"name": "getPanelByIdBatch",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "panelId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "panelState",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "userAddr",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "tokenId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "amount",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "fee",
						"type": "uint256"
					},
					{
						"internalType": "string",
						"name": "didUri",
						"type": "string"
					},
					{
						"internalType": "uint256",
						"name": "createTime",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "removeTime",
						"type": "uint256"
					}
				],
				"internalType": "struct IGalleria.PanelInfo[]",
				"name": "",
				"type": "tuple[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getPanelCount",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getTokenAddress",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_user",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_index",
				"type": "uint256"
			}
		],
		"name": "getUserActivePanelByIndex",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "panelId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "panelState",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "userAddr",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "tokenId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "amount",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "fee",
						"type": "uint256"
					},
					{
						"internalType": "string",
						"name": "didUri",
						"type": "string"
					},
					{
						"internalType": "uint256",
						"name": "createTime",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "removeTime",
						"type": "uint256"
					}
				],
				"internalType": "struct IGalleria.PanelInfo",
				"name": "",
				"type": "tuple"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_user",
				"type": "address"
			},
			{
				"internalType": "uint256[]",
				"name": "_indexes",
				"type": "uint256[]"
			}
		],
		"name": "getUserActivePanelByIndexBatch",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "panelId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "panelState",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "userAddr",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "tokenId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "amount",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "fee",
						"type": "uint256"
					},
					{
						"internalType": "string",
						"name": "didUri",
						"type": "string"
					},
					{
						"internalType": "uint256",
						"name": "createTime",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "removeTime",
						"type": "uint256"
					}
				],
				"internalType": "struct IGalleria.PanelInfo[]",
				"name": "",
				"type": "tuple[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_user",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_tokenId",
				"type": "uint256"
			}
		],
		"name": "getUserActivePanelByToken",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "panelId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "panelState",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "userAddr",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "tokenId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "amount",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "fee",
						"type": "uint256"
					},
					{
						"internalType": "string",
						"name": "didUri",
						"type": "string"
					},
					{
						"internalType": "uint256",
						"name": "createTime",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "removeTime",
						"type": "uint256"
					}
				],
				"internalType": "struct IGalleria.PanelInfo",
				"name": "",
				"type": "tuple"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_user",
				"type": "address"
			},
			{
				"internalType": "uint256[]",
				"name": "_tokenIds",
				"type": "uint256[]"
			}
		],
		"name": "getUserActivePanelByTokenBatch",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "panelId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "panelState",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "userAddr",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "tokenId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "amount",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "fee",
						"type": "uint256"
					},
					{
						"internalType": "string",
						"name": "didUri",
						"type": "string"
					},
					{
						"internalType": "uint256",
						"name": "createTime",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "removeTime",
						"type": "uint256"
					}
				],
				"internalType": "struct IGalleria.PanelInfo[]",
				"name": "",
				"type": "tuple[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_addr",
				"type": "address"
			}
		],
		"name": "getUserByAddr",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "index",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "userAddr",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "panelTotal",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "panelActive",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "feeTotal",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "joinTime",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "lastActionTime",
						"type": "uint256"
					}
				],
				"internalType": "struct IGalleria.UserInfo",
				"name": "",
				"type": "tuple"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address[]",
				"name": "_addrs",
				"type": "address[]"
			}
		],
		"name": "getUserByAddrBatch",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "index",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "userAddr",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "panelTotal",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "panelActive",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "feeTotal",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "joinTime",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "lastActionTime",
						"type": "uint256"
					}
				],
				"internalType": "struct IGalleria.UserInfo[]",
				"name": "",
				"type": "tuple[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_index",
				"type": "uint256"
			}
		],
		"name": "getUserByIndex",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "index",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "userAddr",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "panelTotal",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "panelActive",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "feeTotal",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "joinTime",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "lastActionTime",
						"type": "uint256"
					}
				],
				"internalType": "struct IGalleria.UserInfo",
				"name": "",
				"type": "tuple"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256[]",
				"name": "_indexes",
				"type": "uint256[]"
			}
		],
		"name": "getUserByIndexBatch",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "index",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "userAddr",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "panelTotal",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "panelActive",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "feeTotal",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "joinTime",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "lastActionTime",
						"type": "uint256"
					}
				],
				"internalType": "struct IGalleria.UserInfo[]",
				"name": "",
				"type": "tuple[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getUserCount",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_user",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_index",
				"type": "uint256"
			}
		],
		"name": "getUserPanelByIndex",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "panelId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "panelState",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "userAddr",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "tokenId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "amount",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "fee",
						"type": "uint256"
					},
					{
						"internalType": "string",
						"name": "didUri",
						"type": "string"
					},
					{
						"internalType": "uint256",
						"name": "createTime",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "removeTime",
						"type": "uint256"
					}
				],
				"internalType": "struct IGalleria.PanelInfo",
				"name": "",
				"type": "tuple"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_user",
				"type": "address"
			},
			{
				"internalType": "uint256[]",
				"name": "_indexes",
				"type": "uint256[]"
			}
		],
		"name": "getUserPanelByIndexBatch",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "panelId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "panelState",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "userAddr",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "tokenId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "amount",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "fee",
						"type": "uint256"
					},
					{
						"internalType": "string",
						"name": "didUri",
						"type": "string"
					},
					{
						"internalType": "uint256",
						"name": "createTime",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "removeTime",
						"type": "uint256"
					}
				],
				"internalType": "struct IGalleria.PanelInfo[]",
				"name": "",
				"type": "tuple[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getVersion",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "pure",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_tokenAddress",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_platformAddress",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_minFee",
				"type": "uint256"
			}
		],
		"name": "initialize",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "initialize",
		"outputs": [],
		"stateMutability": "pure",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "initialized",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_operator",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_from",
				"type": "address"
			},
			{
				"internalType": "uint256[]",
				"name": "_ids",
				"type": "uint256[]"
			},
			{
				"internalType": "uint256[]",
				"name": "_values",
				"type": "uint256[]"
			},
			{
				"internalType": "bytes",
				"name": "_data",
				"type": "bytes"
			}
		],
		"name": "onERC1155BatchReceived",
		"outputs": [
			{
				"internalType": "bytes4",
				"name": "",
				"type": "bytes4"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_operator",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_from",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_id",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_value",
				"type": "uint256"
			},
			{
				"internalType": "bytes",
				"name": "_data",
				"type": "bytes"
			}
		],
		"name": "onERC1155Received",
		"outputs": [
			{
				"internalType": "bytes4",
				"name": "",
				"type": "bytes4"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_panelId",
				"type": "uint256"
			}
		],
		"name": "removePanel",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_platformAddress",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_minFee",
				"type": "uint256"
			}
		],
		"name": "setFeeParams",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes4",
				"name": "_interfaceId",
				"type": "bytes4"
			}
		],
		"name": "supportsInterface",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "pure",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_owner",
				"type": "address"
			}
		],
		"name": "transferOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_newAddress",
				"type": "address"
			}
		],
		"name": "updateCodeAddress",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
]