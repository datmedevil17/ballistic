/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/ballistic.json`.
 */
export type Ballistic = {
  "address": "FeM2fDoHX1wTppwwxSsg1xkXzAwei9WCk3C6tsgozobB",
  "metadata": {
    "name": "ballistic",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "claimRewards",
      "docs": [
        "Mint BALLISTIC tokens for all unclaimed kills and reset the tally.",
        "Rate: 1 kill = 1 BALLISTIC (9 decimals). Works for kills from any game mode."
      ],
      "discriminator": [
        4,
        144,
        132,
        71,
        116,
        23,
        151,
        80
      ],
      "accounts": [
        {
          "name": "mint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  108,
                  108,
                  105,
                  115,
                  116,
                  105,
                  99,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mintAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "pendingRewards",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  119,
                  97,
                  114,
                  100,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "playerTokenAccount",
          "docs": [
            "Player's BALLISTIC token account — created here if it does not exist."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "player"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "collectSessionRewards",
      "docs": [
        "Credits kills from the ended session into the player's PendingRewards tally.",
        "Closes the session account (reclaims rent). Call after end_session commits."
      ],
      "discriminator": [
        114,
        239,
        189,
        99,
        74,
        72,
        45,
        140
      ],
      "accounts": [
        {
          "name": "playerSession",
          "docs": [
            "Session is closed after this call — rent returned to player."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "pendingRewards",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  119,
                  97,
                  114,
                  100,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createRoom",
      "docs": [
        "Creator initialises the room on base layer. Status = Lobby."
      ],
      "discriminator": [
        130,
        166,
        32,
        2,
        247,
        120,
        178,
        53
      ],
      "accounts": [
        {
          "name": "gameRoom",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  114,
                  111,
                  111,
                  109
                ]
              },
              {
                "kind": "arg",
                "path": "roomId"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "roomId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "delegateRoom",
      "docs": [
        "Creator delegates the GameRoom PDA to the ER.",
        "Must be called after start_game. All subsequent gameplay is gasless."
      ],
      "discriminator": [
        39,
        6,
        122,
        70,
        65,
        76,
        166,
        26
      ],
      "accounts": [
        {
          "name": "creator",
          "signer": true
        },
        {
          "name": "bufferGameRoom",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "gameRoom"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                217,
                148,
                192,
                217,
                121,
                23,
                7,
                175,
                29,
                146,
                212,
                214,
                56,
                251,
                254,
                77,
                1,
                177,
                38,
                80,
                21,
                81,
                86,
                144,
                60,
                211,
                201,
                51,
                67,
                5,
                126,
                94
              ]
            }
          }
        },
        {
          "name": "delegationRecordGameRoom",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "gameRoom"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataGameRoom",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "gameRoom"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "gameRoom",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  114,
                  111,
                  111,
                  109
                ]
              },
              {
                "kind": "arg",
                "path": "roomId"
              }
            ]
          }
        },
        {
          "name": "ownerProgram",
          "address": "FeM2fDoHX1wTppwwxSsg1xkXzAwei9WCk3C6tsgozobB"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "roomId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "delegateSession",
      "docs": [
        "Delegates the player session PDA to the Ephemeral Rollup.",
        "After this all solo gameplay txs are gasless."
      ],
      "discriminator": [
        82,
        83,
        119,
        119,
        196,
        219,
        5,
        197
      ],
      "accounts": [
        {
          "name": "player",
          "signer": true
        },
        {
          "name": "bufferPlayerSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "playerSession"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                217,
                148,
                192,
                217,
                121,
                23,
                7,
                175,
                29,
                146,
                212,
                214,
                56,
                251,
                254,
                77,
                1,
                177,
                38,
                80,
                21,
                81,
                86,
                144,
                60,
                211,
                201,
                51,
                67,
                5,
                126,
                94
              ]
            }
          }
        },
        {
          "name": "delegationRecordPlayerSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "playerSession"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataPlayerSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "playerSession"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "playerSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "ownerProgram",
          "address": "FeM2fDoHX1wTppwwxSsg1xkXzAwei9WCk3C6tsgozobB"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "endGame",
      "docs": [
        "Last surviving player calls this to end the game — gasless ER tx.",
        "Commits the final room state to base layer and undelegates.",
        "If all players exhaust lives simultaneously, any room member can close."
      ],
      "discriminator": [
        224,
        135,
        245,
        99,
        67,
        175,
        121,
        252
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "gameRoom",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  114,
                  111,
                  111,
                  109
                ]
              },
              {
                "kind": "arg",
                "path": "roomId"
              }
            ]
          }
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "roomId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "endSession",
      "docs": [
        "Player exits to home screen — commits final kill state and undelegates.",
        "Call collect_session_rewards on base layer after this."
      ],
      "discriminator": [
        11,
        244,
        61,
        154,
        212,
        249,
        15,
        66
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "playerSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeMint",
      "docs": [
        "Initialise the BALLISTIC SPL token mint.",
        "Mint authority is a program PDA — only claim_rewards can ever mint."
      ],
      "discriminator": [
        209,
        42,
        195,
        4,
        129,
        85,
        209,
        44
      ],
      "accounts": [
        {
          "name": "mint",
          "docs": [
            "The BALLISTIC token mint — fixed program PDA, created once."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  108,
                  108,
                  105,
                  115,
                  116,
                  105,
                  99,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mintAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "joinRoom",
      "docs": [
        "Any player joins the room while it is in Lobby."
      ],
      "discriminator": [
        95,
        232,
        188,
        81,
        124,
        130,
        78,
        139
      ],
      "accounts": [
        {
          "name": "gameRoom",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  114,
                  111,
                  111,
                  109
                ]
              },
              {
                "kind": "arg",
                "path": "roomId"
              }
            ]
          }
        },
        {
          "name": "player",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "roomId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "leaveRoom",
      "docs": [
        "Player leaves the room while it is still in Lobby."
      ],
      "discriminator": [
        249,
        42,
        239,
        128,
        192,
        20,
        114,
        156
      ],
      "accounts": [
        {
          "name": "gameRoom",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  114,
                  111,
                  111,
                  109
                ]
              },
              {
                "kind": "arg",
                "path": "roomId"
              }
            ]
          }
        },
        {
          "name": "player",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "roomId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "processUndelegation",
      "discriminator": [
        196,
        28,
        41,
        206,
        48,
        37,
        51,
        167
      ],
      "accounts": [
        {
          "name": "baseAccount",
          "writable": true
        },
        {
          "name": "buffer"
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "accountSeeds",
          "type": {
            "vec": "bytes"
          }
        }
      ]
    },
    {
      "name": "recordKill",
      "docs": [
        "Record a kill — gasless ER tx.",
        "Killer's counter increments. Victim loses one life and is marked dead."
      ],
      "discriminator": [
        199,
        67,
        232,
        200,
        144,
        122,
        230,
        56
      ],
      "accounts": [
        {
          "name": "gameRoom",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  114,
                  111,
                  111,
                  109
                ]
              },
              {
                "kind": "arg",
                "path": "roomId"
              }
            ]
          }
        },
        {
          "name": "player",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "roomId",
          "type": "u64"
        },
        {
          "name": "victim",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "recordSoloKill",
      "docs": [
        "Record an AI kill — gasless ER tx.",
        "Increments player's kill counter and score in the session PDA."
      ],
      "discriminator": [
        220,
        113,
        189,
        204,
        209,
        181,
        78,
        185
      ],
      "accounts": [
        {
          "name": "playerSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "player",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "respawn",
      "docs": [
        "Player respawns after cooldown — gasless ER tx.",
        "Only allowed if the player still has lives remaining."
      ],
      "discriminator": [
        21,
        232,
        156,
        94,
        79,
        43,
        204,
        41
      ],
      "accounts": [
        {
          "name": "gameRoom",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  114,
                  111,
                  111,
                  109
                ]
              },
              {
                "kind": "arg",
                "path": "roomId"
              }
            ]
          }
        },
        {
          "name": "player",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "roomId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "soloRespawn",
      "docs": [
        "Player respawns after dying to AI — gasless ER tx.",
        "Commits current kill state to base layer as a checkpoint, then marks alive."
      ],
      "discriminator": [
        70,
        143,
        33,
        64,
        0,
        188,
        167,
        178
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "playerSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "startAiGame",
      "docs": [
        "Creates the player's session PDA on base layer.",
        "Call delegate_session immediately after."
      ],
      "discriminator": [
        25,
        40,
        235,
        97,
        207,
        23,
        102,
        28
      ],
      "accounts": [
        {
          "name": "playerSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "startGame",
      "docs": [
        "Creator locks the room and marks it Active. Requires at least 2 players.",
        "Call start_game then delegate_room back-to-back."
      ],
      "discriminator": [
        249,
        47,
        252,
        172,
        184,
        162,
        245,
        14
      ],
      "accounts": [
        {
          "name": "gameRoom",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  114,
                  111,
                  111,
                  109
                ]
              },
              {
                "kind": "arg",
                "path": "roomId"
              }
            ]
          }
        },
        {
          "name": "creator",
          "signer": true,
          "relations": [
            "gameRoom"
          ]
        }
      ],
      "args": [
        {
          "name": "roomId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateRewards",
      "docs": [
        "Credits a player's kills from an ended room into their PendingRewards tally.",
        "Must be called on base layer after end_game has committed the room.",
        "Each player calls this once — double-credit is blocked by rewards_credited flag."
      ],
      "discriminator": [
        188,
        38,
        124,
        42,
        87,
        77,
        176,
        90
      ],
      "accounts": [
        {
          "name": "gameRoom",
          "docs": [
            "The committed (Ended) game room — read to pull player kill count."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  114,
                  111,
                  111,
                  109
                ]
              },
              {
                "kind": "arg",
                "path": "roomId"
              }
            ]
          }
        },
        {
          "name": "pendingRewards",
          "docs": [
            "Created on first update_rewards call by this player."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  119,
                  97,
                  114,
                  100,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "roomId",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "gameRoom",
      "discriminator": [
        201,
        210,
        56,
        115,
        19,
        56,
        27,
        69
      ]
    },
    {
      "name": "pendingRewards",
      "discriminator": [
        191,
        172,
        135,
        248,
        109,
        151,
        9,
        38
      ]
    },
    {
      "name": "playerSession",
      "discriminator": [
        89,
        95,
        51,
        45,
        127,
        42,
        173,
        223
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "roomFull",
      "msg": "Room is full (max 10 players)"
    },
    {
      "code": 6001,
      "name": "alreadyInRoom",
      "msg": "Player is already in this room"
    },
    {
      "code": 6002,
      "name": "gameAlreadyStarted",
      "msg": "Game has already started"
    },
    {
      "code": 6003,
      "name": "gameNotStarted",
      "msg": "Game has not been started yet — call start_game first"
    },
    {
      "code": 6004,
      "name": "gameNotActive",
      "msg": "Game is not active"
    },
    {
      "code": 6005,
      "name": "gameNotEnded",
      "msg": "Game has not ended yet"
    },
    {
      "code": 6006,
      "name": "notEnoughPlayers",
      "msg": "Need at least 2 players to start"
    },
    {
      "code": 6007,
      "name": "notCreator",
      "msg": "Only the room creator can do this"
    },
    {
      "code": 6008,
      "name": "playerNotFound",
      "msg": "Player not found in this room"
    },
    {
      "code": 6009,
      "name": "cannotKillSelf",
      "msg": "Cannot kill yourself"
    },
    {
      "code": 6010,
      "name": "callerIsDead",
      "msg": "Dead players cannot record kills"
    },
    {
      "code": 6011,
      "name": "victimAlreadyDead",
      "msg": "Victim is already dead"
    },
    {
      "code": 6012,
      "name": "alreadyAlive",
      "msg": "Player is already alive"
    },
    {
      "code": 6013,
      "name": "noLivesRemaining",
      "msg": "No lives remaining — permanently out"
    },
    {
      "code": 6014,
      "name": "gameStillActive",
      "msg": "Game still has active players"
    },
    {
      "code": 6015,
      "name": "notTheWinner",
      "msg": "Only the last surviving player can end the game"
    },
    {
      "code": 6016,
      "name": "rewardsAlreadyCredited",
      "msg": "Rewards already credited for this game"
    },
    {
      "code": 6017,
      "name": "nothingToClaim",
      "msg": "No kills to claim"
    },
    {
      "code": 6018,
      "name": "overflow",
      "msg": "Token amount overflow"
    }
  ],
  "types": [
    {
      "name": "gameRoom",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "roomId",
            "type": "u64"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "players",
            "type": {
              "vec": {
                "defined": {
                  "name": "playerEntry"
                }
              }
            }
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "gameStatus"
              }
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "gameStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "lobby"
          },
          {
            "name": "active"
          },
          {
            "name": "ended"
          }
        ]
      }
    },
    {
      "name": "pendingRewards",
      "docs": [
        "Persistent profile kill accumulator — lives on base layer across all games.",
        "Both solo (collect_session_rewards) and multiplayer (update_rewards) feed into this.",
        "Call claim_rewards to mint tokens."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "unclaimedKills",
            "type": "u64"
          },
          {
            "name": "totalKillsEver",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "playerEntry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pubkey",
            "type": "pubkey"
          },
          {
            "name": "kills",
            "type": "u64"
          },
          {
            "name": "score",
            "type": "u64"
          },
          {
            "name": "lives",
            "type": "u8"
          },
          {
            "name": "alive",
            "type": "bool"
          },
          {
            "name": "rewardsCredited",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "playerSession",
      "docs": [
        "Per-session solo game state. Lives on ER while game is active, committed on exit."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "kills",
            "type": "u64"
          },
          {
            "name": "score",
            "type": "u64"
          },
          {
            "name": "lives",
            "type": "u8"
          },
          {
            "name": "alive",
            "type": "bool"
          }
        ]
      }
    }
  ]
};
