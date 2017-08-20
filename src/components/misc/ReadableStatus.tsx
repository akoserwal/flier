import * as moment from "moment";
import * as React from "react";
import { API } from "../../tg/Codegen/API/APISchema";
import { CSSTransitionGroup } from "react-transition-group";
import { tg } from "../App";

interface Props {
    of: API.User | API.Chat | API.ChatForbidden | API.Channel | API.ChatForbidden,
}

interface State {

}

export class ReadableStatus extends React.Component<Props, State> {
    private statusIntervalId: number;

    componentDidMount() {
        this.statusIntervalId = setInterval(
            () => this.forceUpdate(),
            5000);
    }

    shouldComponentUpdate(nextProps: Props) {
        return nextProps.of !== this.props.of;
    }

    componentWillUnmount() {
        clearInterval(this.statusIntervalId);
    }

    render() {
        let element: JSX.Element;
        if (this.props.of instanceof API.User) {
            const status = readableStatus(this.props.of);
            const key = (typeof status === "string") ? status : "online";
            element = <span key={key}>{status}</span>;
        } else if (this.props.of instanceof API.Chat) {
            const key = this.props.of.participantsCount.value;
            element = <span key={key}>{this.props.of.participantsCount.value} participants</span>;
        } else if (this.props.of instanceof API.Channel) {
            element = <span key={"channel"}>channel</span>;
        } else if (this.props.of instanceof API.ChatForbidden || API.ChannelForbidden) {
            element = <span key={"forbidden"}>forbidden</span>;
        } else {
            throw new Error();
        }

        return (
            <span>
                <style type="text/css">{statusStyle}</style>
                <CSSTransitionGroup
                    transitionName="status-transition"
                    transitionEnterTimeout={150}
                    transitionLeaveTimeout={150}>
                    {
                        element
                    }
                </CSSTransitionGroup>
            </span>
        )
    }
}

export const readableStatus = (user: API.User): JSX.Element | string => {
    if (user.id.value === 777000) {
        return "service notifications";
    } else if (user.self) {
        return "you";
    } else if (user.bot) {
        return "bot";
    }

    if (user.status instanceof API.UserStatusOnline) {
        return <span style={{ color: "rgba(61,129,161,1)" }}>online</span>;
    } else if (user.status instanceof API.UserStatusOffline) {
        const minutesDiff = moment()
            .diff(moment.unix(user.status.wasOnline.value), "minutes");
        if (minutesDiff === 0) {
            return "last seen just now";
        } else if (minutesDiff === 1) {
            return "last seen one minute ago";
        } else if (minutesDiff <= 59) {
            return `last seen ${minutesDiff} minutes ago`;
        } else {
            const daysDiff = moment()
                .diff(moment.unix(user.status.wasOnline.value), "days");
            if (daysDiff === 0) {
                const hoursDiff = moment()
                    .diff(moment.unix(user.status.wasOnline.value), "hours");
                if (hoursDiff === 1) {
                    return "last seen one hour ago";
                } else {
                    return `last seen ${hoursDiff} hours ago`;
                }
            } else {
                return `last seen ${
                    moment.unix(user.status.wasOnline.value).format("L")}`;
            }
        }
    } else if (user.status instanceof API.UserStatusRecently) {
        return "last seen recently";
    } else if (user.status instanceof API.UserStatusLastWeek) {
        return "last seen within a week";
    } else if (user.status instanceof API.UserStatusLastMonth) {
        return "last seen within a month";
    }

    return "last seen a long time ago";
};

const statusStyle = `
.status-transition-enter {
    position: absolute;
    opacity: 0;
    transition: opacity 150ms ease;
}

.status-transition-enter.status-transition-enter-active {
    opacity: 1;
}

.status-transition-leave {
    opacity: 1;
    transition: opacity 150ms ease;
}

.status-transition-leave.status-transition-leave-active {
    opacity: 0;
}`;
