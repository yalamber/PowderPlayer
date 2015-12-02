﻿import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import path from 'path';
import wcjsRenderer from '../utils/wcjs-renderer';
import _ from 'lodash';
import {
    RaisedButton
}
from 'material-ui';

import PlayerActions from '../actions';
import PlayerStore from '../store';

try {
    var wcjs = require(path.join(process.cwd(), 'resources/bin/', 'WebChimera.js.node'));
} catch (e) {
    console.error('WCJS Load Error:', e);
}

export
default React.createClass({

    mixins: [PureRenderMixin],

    getInitialState() {

        var playerState = PlayerStore.getState();

        return {
            initialResize: false,

            volume: playerState.volume,
            playing: playerState.playing,
            paused: playerState.paused,
            fullscreen: playerState.fullscreen,
            
            rippleEffects: playerState.rippleEffects
        }
    },
    componentWillMount() {
        PlayerStore.listen(this.update);
        window.addEventListener('resize', this.handleResize);
    },
    componentDidMount() {
        if (!PlayerStore.getState().wcjs) {
            PlayerActions.wcjsInit(wcjsRenderer.init(this.refs['wcjs-render'], [
                "--no-media-library",
                "--no-sub-autodetect-file",
                "--no-spu",
                "--no-stats",
                "--no-osd",
                "--network-caching=3500",
                "--file-caching=3000",
                "--no-skip-frames",
                "--no-video-title-show",
                "--disable-screensaver",
                "--no-autoscale",
                "--ipv4-timeout=86400000"
            ], {
                fallbackRenderer: false,
                preserveDrawingBuffer: true
            }, wcjs));
        } else {
            wcjsRenderer.reinit(this.refs['wcjs-render'], PlayerStore.getState().wcjs, {
                fallbackRenderer: false,
                preserveDrawingBuffer: true
            });
        }
        this.initPlayer();
    },
    componentWillUnmount() {
        wcjsRenderer.clearCanvas();
        PlayerStore.unlisten(this.update);
        window.removeEventListener('resize', this.handleResize);
    },
    update() {
        if (this.isMounted()) {

            var playerState = PlayerStore.getState();

            this.setState({
                uri: playerState.uri,
                playing: playerState.playing,
                fullscreen: playerState.fullscreen,
                volume: playerState.volume,
                rippleEffects: playerState.rippleEffects
            });
        }
    },
    initPlayer() {
        this.player = PlayerStore.getState().wcjs;
        this.pendingFiles = PlayerStore.getState().pendingFiles;

        var initializeSize = _.once(() => {
            if (!this.state.initialResize) {
                this.setState({
                    initialResize: true
                });
                this.handleResize();
            }
        });

        this.player.onPositionChanged = _.throttle((pos) => {
            PlayerActions.position(pos);
            initializeSize();
        }, 500);

        this.player.onOpening = PlayerActions.opening;

        this.player.onTimeChanged = PlayerActions.time;

        this.player.onBuffering = _.throttle(PlayerActions.buffering, 500);

        this.player.onLengthChanged = PlayerActions.length;

        this.player.onSeekableChanged = PlayerActions.seekable;

        this.player.onPlaying = PlayerActions.playing;

        this.player.onPaused = PlayerActions.pause;

        this.player.onStopped = PlayerActions.stopped;

        this.player.onEndReached = PlayerActions.ended;

        this.player.onEncounteredError = PlayerActions.error;


        if (this.pendingFiles && this.pendingFiles.length) {

            if (this.player.playlist.items.count == 0) 
                var playAfter = true;

            for (var i = 0; this.pendingFiles[i]; i++) {
                if (typeof this.pendingFiles[i] === 'string') {
                    this.player.playlist.add(this.pendingFiles[i]);
                } else if (this.pendingFiles[i].uri) {
                    this.player.playlist.add(this.pendingFiles[i].uri);
                    if (this.pendingFiles[i].title) {
                        this.player.playlist.items[this.player.playlist.items.count-1].title = this.pendingFiles[i].title;
                    }
                }
            }

            if (playAfter) PlayerActions.play();

        }

    },
    handleResize() {
        var canvas = this.refs['wcjs-render'];
        var container = document.body;
        var sourceAspect = canvas.width / canvas.height;
        var destAspect = container.clientWidth / container.clientHeight;
        var cond = destAspect > sourceAspect;

        if (cond) {
            canvas.style.height = "100%";
            canvas.style.width = ((container.clientHeight * sourceAspect) / container.clientWidth) * 100 + '%';
        } else {
            canvas.style.height = ((container.clientWidth / sourceAspect) / container.clientHeight) * 100 + '%';
            canvas.style.width = "100%";
        };
    },
    handleTogglePlay() {
        this.state.playing ? PlayerActions.pause() : PlayerActions.play();
    },
    wheel(event) {
        var volume = (event.deltaY < 0) ? this.player.volume + 5 : this.player.volume - 5;
        PlayerActions.volume(volume);
    },
    render() {
        var renderStyles = {
            container: {
                textAlign: 'center'
            },
            canvas: {
                display: 'inline-block',
                height: '100vh',
                opacity: this.state.initialResize ? 1 : 0,
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%,-50%)'
            }
        };
        return (
            <div className="canvas-holder" onWheel={this.wheel} style={renderStyles.container}>
                <RaisedButton onClick={this.handleTogglePlay} onDoubleClick={PlayerActions.toggleFullscreen.bind(this, !this.state.fullscreen)} iconClassName="material-icons" className={this.state.rippleEffects ? 'over-canvas' : 'over-canvas no-ripples' } label="Canvas Overlay" />
                <canvas style={renderStyles.canvas} onClick={this.handleTogglePlay} onDoubleClick={PlayerActions.toggleFullscreen.bind(this, !this.state.fullscreen)} ref="wcjs-render" />
            </div>
        );
    }
});