/* Copyright (c) 2017 Juri Torhoff
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { StyleSheet, css } from "aphrodite/no-important";
import { List } from "immutable";
import { List as MaterialList, makeSelectable } from "material-ui";
import { faintBlack } from "material-ui/styles/colors";
import * as moment from "moment";
import * as React from "react";
import {
    List as VirtualizedList,
    InfiniteLoader,
    AutoSizer,
    ListRowProps,
    IndexRange
} from "react-virtualized";
import { Subscription } from "rxjs/Subscription";
import { buffersEqual } from "../../misc/CompareArrayBuffer";
import { API } from "../../tg/Codegen/API/APISchema";
import { Chat } from "../../tg/TG";
import { Update } from "../../tg/Updates/Update";
import { tg } from "../App";
import { ChatsListItem } from "./ChatsListItem";

interface Props {
    selectedPeer: (peer: API.PeerType) => void,
}

interface State {
    chats: List<Chat>,
    typing: List<Array<{
        readonly user: API.User,
        readonly action: API.SendMessageActionType,
        readonly expires: number
    }>>,
    selectedPeer?: API.PeerType,
}

export class ChatsList extends React.Component<Props, State> {
    private loadingChats = false;
    private allChatsLoaded = false;
    private chatsSubscriptions: Subscription;
    private updatesSubscription: Subscription;
    private typingIntervalId: number;

    state: State = {
        chats: List(),
        typing: List(),
    };

    isRowLoaded(params: { index: number }): boolean {
        return this.allChatsLoaded || params.index < this.state.chats.size;
    }

    loadMoreRows(params: IndexRange): Promise<any> {
        if (this.loadingChats) return Promise.resolve();

        this.loadingChats = true;
        this.chatsSubscriptions = tg.getChats(30, this.state.chats.get(params.startIndex - 1))
            .subscribe({
                next: chats => {
                    if (chats.length === 0) {
                        this.allChatsLoaded = true;
                    } else {
                        this.setState(state => {
                            return {
                                chats: state.chats.concat(chats).toList(),
                            }
                        });
                    }
                },
                complete: () => {
                    this.loadingChats = false;
                }
            });

        return Promise.resolve();
    }

    rowCount(): number {
        return this.allChatsLoaded ?
            this.state.chats.size :
            this.state.chats.size + 1;
    }

    renderRow(params: ListRowProps): React.ReactNode {
        const chat = this.state.chats.get(params.index);
        const selectedIndex = this.state.chats.findIndex(chat =>
            !!this.state.selectedPeer && chat!.peerEquals(this.state.selectedPeer));
        return (
            <div key={params.key} style={params.style}>
                <ChatsListItem
                    selected={!!this.state.selectedPeer && chat.peerEquals(this.state.selectedPeer)}
                    onClick={() => {
                        this.props.selectedPeer(chat.peer);
                        this.setState({
                            selectedPeer: chat.peer
                        });
                    }}
                    chat={chat}
                    typing={this.state.typing.get(params.index) || []}/>
                {
                    // Don't show divider for the last item
                    params.index < this.state.chats.size - 1 &&
                    // Don't show for the current item when selected...
                    selectedIndex !== params.index &&
                    // ...and for the item above
                    selectedIndex !== params.index + 1 &&
                    <hr className={css(styles.divider)}/>
                }
            </div>
        );
    }

    handleUpdate(update: Update) {
        switch (update.constructor) {
            case Update.NewMessage: {
                const message = (update as Update.NewMessage).message;
                const index = this.state.chats
                    .findIndex(chat =>
                        !!message.peer && !!chat && chat.peerEquals(message.peer));
                if (index !== -1) {
                    this.setState(state => {
                        if (state.chats.get(index).topMessage.date > message.date) {
                            return {};
                        }
                        const chat = state.chats.get(index)
                            .setTopMessage(message);
                        return {
                            chats: state.chats
                                .remove(index)
                                .insert(0, chat),
                            typing: state.typing.set(index, []),
                        }
                    });
                } else if (message.peer) {
                    tg.getChat(message.peer)
                        .subscribe(chat => {
                            this.setState(state => {
                                const index = state.chats
                                    .find(item => item!.peerEquals(chat.peer));
                                if (index) {
                                    return {};
                                }

                                return {
                                    chats: state.chats
                                        .insert(0, chat),
                                }
                            });
                        });
                }
            } break;

            case Update.TopMessage: {
                const message = (update as Update.TopMessage).message;
                const index = this.state.chats
                    .findIndex(chat =>
                        !!message.peer && !!chat && chat.peerEquals(message.peer));
                if (index !== -1) {
                    this.setState(state => {
                        const chat = state.chats.get(index)
                            .setTopMessage(message);
                        return {
                            chats: state.chats.set(index, chat),
                        }
                    });
                }
            } break;

            case Update.ReadHistoryInbox: {
                const upd = update as Update.ReadHistoryInbox;
                const index = this.state.chats
                    .findIndex(chat =>
                        !!chat && chat.peerEquals(upd.peer));
                if (index !== -1) {
                    this.setState(state => {
                        const chat = state.chats.get(index)
                            .setReadInboxMaxId(upd.maxId);
                        return {
                            chats: state.chats.set(index, chat),
                        }
                    });
                }
            } break;

            case Update.ReadHistoryOutbox: {
                const upd = update as Update.ReadHistoryOutbox;
                const index = this.state.chats
                    .findIndex(chat =>
                        !!chat && chat.peerEquals(upd.peer));
                if (index !== -1) {
                    this.setState(state => {
                        const chat = state.chats.get(index)
                            .setReadOutboxMaxId(upd.maxId);
                        return {
                            chats: state.chats.set(index, chat),
                        }
                    });
                }
            } break;

            case Update.User: {
                const upd = update as Update.User;
                const index = this.state.chats
                    .findIndex(chat =>
                        !!chat  &&
                        chat.kind.kind === "dialog" &&
                        chat.kind.user.id.equals(upd.user.id));
                if (index !== -1) {
                    this.setState(state => {
                        const chat = state.chats.get(index)
                            .setKind({ kind: "dialog", user: upd.user });
                        return {
                            chats: state.chats.set(index, chat),
                        }
                    });
                }
            } break;

            case Update.Chat: {
                const upd = update as Update.Chat;
                const index = this.state.chats
                    .findIndex(chat =>
                        !!chat  &&
                        chat.kind.kind === "chat" &&
                        chat.kind.chat.id.equals(upd.chat.id));
                if (index !== -1) {
                    this.setState(state => {
                        const chat = state.chats.get(index)
                            .setKind({ kind: "chat", chat: upd.chat });
                        return {
                            chats: state.chats.set(index, chat),
                        }
                    });
                }
            } break;

            case Update.Channel: {
                const upd = update as Update.Channel;
                const index = this.state.chats
                    .findIndex(chat =>
                        !!chat  &&
                        chat.kind.kind === "channel" &&
                        chat.kind.channel.id.equals(upd.channel.id));
                if (index !== -1) {
                    this.setState(state => {
                        const chat = state.chats.get(index)
                            .setKind({ kind: "channel", channel: upd.channel });
                        return {
                            chats: state.chats.set(index, chat),
                        }
                    });
                }
            } break;

            case Update.UserTyping: {
                const upd = update as Update.UserTyping;
                const index = this.state.chats
                    .findIndex(chat =>
                        !!chat && chat.peerEquals(upd.peer));
                if (index !== -1) {
                    if (this.state.typing.has(index)) {
                        this.setState(state => {
                            let typing = state.typing.get(index);
                            if (typing) {
                                typing = typing.filter(typing =>
                                    !typing.user.id.equals(upd.user.id));
                            } else {
                                typing = [];
                            }
                            typing.push(upd);

                            return {
                                typing: state.typing.set(index, typing),
                            }
                        });
                    } else {
                        this.setState(state => {
                            return {
                                typing: state.typing.set(index, [upd]),
                            }
                        });
                    }
                }
            } break;

            case Update.EditMessage: {
                const upd = update as Update.EditMessage;
                const index = this.state.chats
                    .findIndex(chat =>
                        !!chat && (chat.topMessage.id === upd.message.id
                        || buffersEqual(chat.topMessage.randomId, upd.message.randomId)));
                if (index !== -1) {
                    this.setState(state => {
                        const chat = state.chats.get(index)
                            .setTopMessage(upd.message);
                        return {
                            chats: state.chats.set(index, chat),
                        }
                    });
                }
            } break;
        }
    }

    clearTypingActions() {
        const now = moment().unix();
        const typing = this.state.typing.withMutations(typings => {
            typings.forEach((typing, index) => {
                if (typing) {
                    typings.set(
                        index!,
                        typing.length > 0 ?
                            typing.filter(typing => typing.expires > now) :
                            typing
                    );
                }
            });
        });
        this.setState({
            typing: typing,
        });
    }

    componentDidMount() {
        this.updatesSubscription = tg.updates
            .subscribe(update => this.handleUpdate(update));

        this.loadingChats = true;
        this.chatsSubscriptions = tg.getChats(30)
            .subscribe({
                next: chats => {
                    this.setState(state => {
                        return {
                            chats: state.chats.concat(chats).toList(),
                        }
                    });
                },
                complete: () => {
                    this.loadingChats = false;
                }
            });

        this.typingIntervalId = setInterval(
            () => this.clearTypingActions(),
            5000) as any;
    }

    shouldComponentUpdate(nextProps: Props, nextState: State): boolean {
        return nextProps.selectedPeer !== this.props.selectedPeer
            || !nextState.chats.equals(this.state.chats)
            || !nextState.typing.equals(this.state.typing)
            || nextState.selectedPeer !== this.state.selectedPeer;
    }

    componentWillUnmount() {
        this.chatsSubscriptions.unsubscribe();
        this.updatesSubscription.unsubscribe();
        clearInterval(this.typingIntervalId);
    }

    render() {
        return (
            <SelectableList className={css(styles.root)} style={{ padding: 0 }}>
                <InfiniteLoader
                    isRowLoaded={params => this.isRowLoaded(params)}
                    loadMoreRows={params => this.loadMoreRows(params)}
                    rowCount={this.rowCount()}>
                    {({ onRowsRendered, registerChild }) => (
                        <AutoSizer>
                            {({ width, height }) => (
                                <VirtualizedList
                                    ref={registerChild}
                                    width={width}
                                    height={height}
                                    rowHeight={90}
                                    overscanRowCount={0}
                                    rowCount={this.state.chats.size}
                                    rowRenderer={params => this.renderRow(params)}
                                    onRowsRendered={onRowsRendered}
                                    style={{
                                        outline: "none"
                                    }}/>
                            )}
                        </AutoSizer>
                    )}
                </InfiniteLoader>
            </SelectableList>
        );
    }
}

const SelectableList: any = makeSelectable(MaterialList);

const styles = StyleSheet.create({
    root: {
        height: "100%",
        maxWidth: 320,
        minWidth: 240,
        borderRight: `1px solid ${faintBlack}`,
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 240,
        overflowY: "auto",
        overflowX: "hidden",
    },
    divider: {
        margin: "-1px 0px 0px 72px",
        height: 1,
        border: "none",
        backgroundColor: "rgb(224, 224, 224)",
    }
});