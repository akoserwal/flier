import { Avatar as MuiAvatar } from "material-ui";
import {
    red300,
    pink300,
    orange300,
    deepOrange300,
    lightGreen300,
    green300,
    teal300,
    cyan300,
    lightBlue300,
    blue300,
    indigo300,
    purple300
} from "material-ui/styles/colors";
import * as React from "react";
import { CSSProperties } from "react";
import { Subscription } from "rxjs/Subscription";
import { API } from "../../tg/Codegen/API/APISchema";
import { tg } from "../App";

interface Props {
    id: number,
    title: string,
    photo?: API.FileLocation,
}

interface State {
    photoDataURL?: string,
}

export class Avatar extends React.Component<Props, State> {
    photoSubscription?: Subscription;

    state: State = {
        photoDataURL: undefined,
    };

    private loadPhoto(photo: API.FileLocation) {
        if (this.photoSubscription) {
            this.photoSubscription.unsubscribe();
        }
        this.photoSubscription = tg.getFile(photo)
            .map(blob => URL.createObjectURL(blob, { oneTimeOnly: true }))
            .subscribe(dataURL => {
                const prevPhotoDataURL = this.state.photoDataURL;
                this.setState({
                    photoDataURL: dataURL,
                });
                if (prevPhotoDataURL) {
                    URL.revokeObjectURL(prevPhotoDataURL);
                }
            });
    }

    componentDidMount() {
        if (this.props.photo) {
            this.loadPhoto(this.props.photo);
        }
    }

    shouldComponentUpdate(nextProps: Props, nextState: State): boolean {
        return nextProps.id !== this.props.id
            || nextProps.title !== this.props.title
            || nextProps.photo !== this.props.photo
            || nextState.photoDataURL !== this.state.photoDataURL;
    }

    componentDidUpdate(prevProps: Props) {
        if (this.props.photo !== prevProps.photo) {
            if (this.props.photo) {
                this.loadPhoto(this.props.photo);
            } else if (this.state.photoDataURL) {
                this.setState({
                    photoDataURL: undefined,
                });
            }
        }
    }

    componentWillUnmount() {
        if (this.photoSubscription) {
            this.photoSubscription.unsubscribe();
        }
        if (this.state.photoDataURL) {
            URL.revokeObjectURL(this.state.photoDataURL);
        }
    }

    render() {
        return (
            <MuiAvatar style={style} backgroundColor={
                this.state.photoDataURL ? "#fff" : hashColor(this.props.id)
            }>
                {this.state.photoDataURL ? (
                    <img style={{ width: "100%", height: "100%", }}
                         src={this.state.photoDataURL}/>
                ) : (
                    extractInitials(this.props.title)
                )}
            </MuiAvatar>
        );
    }
}

const extractInitials = (title: string): string => {
    const components = title.trim().split(/\s|\n/);
    if (components[0] === components[components.length - 1]) {
        return title.substring(0, 1);
    }

    return components[0].substring(0, 1) + components[components.length - 1].substring(0, 1);
};

const colors = [
    red300,
    pink300,
    purple300,
    indigo300,
    blue300,
    lightBlue300,
    cyan300,
    teal300,
    green300,
    lightGreen300,
    orange300,
    deepOrange300,
];

const hashColor = (x: number): string => {
    // Hashing function for integers taken from h2 database
    x = ((x >> 16) ^ x) * 0x45d9f3b;
    x = ((x >> 16) ^ x) * 0x45d9f3b;
    x = (x >> 16) ^ x;

    return colors[x % colors.length];
};

const style: CSSProperties = {
    overflow: "hidden",
};