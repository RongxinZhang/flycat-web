import React, { useState, useEffect, useMemo } from 'react';
import { Grid } from '@mui/material';
import {
  Event,
  EventSubResponse,
  EventSetMetadataContent,
  isEventSubResponse,
  WellKnownEventKind,
  PublicKey,
  PrivateKey,
  RelayUrl,
  PetName,
  isEventETag,
  isEventPTag,
  EventId,
  EventTags,
} from 'service/api';
import { useTimeSince } from 'hooks/useTimeSince';
import LoginForm from '../../components/layout/LoginForm';
import { connect } from 'react-redux';
import RelayManager, {
  WsConnectStatus,
} from '../../components/layout/RelayManager';
import { Content } from '../../components/layout/Content';
import ReplyButton from '../../components/layout/ReplyBtn';
import { useParams } from 'react-router-dom';
import NavHeader from 'app/components/layout/NavHeader';
import { FromWorkerMessageData } from 'service/worker/type';
import { UserMap } from 'service/type';
import { CallWorker } from 'service/worker/callWorker';
import { UserBox, UserRequiredLoginBox } from 'app/components/layout/UserBox';
import { TextMsg } from 'app/components/layout/TextMsg';
import { ShareMsg } from 'app/components/layout/ShareMsg';
import { isFlycatShareHeader, CacheIdentifier } from 'service/flycat-protocol';
import { getPkFromFlycatShareHeader } from 'service/helper';
import { useTranslation } from 'react-i18next';

const mapStateToProps = state => {
  return {
    isLoggedIn: state.loginReducer.isLoggedIn,
    myPublicKey: state.loginReducer.publicKey,
    myPrivateKey: state.loginReducer.privateKey,
  };
};

export const styles = {
  root: {
    maxWidth: '900px',
    margin: '0 auto',
  },
  title: {
    color: 'black',
    fontSize: '2em',
    fontWeight: '380',
    diplay: 'block',
    width: '100%',
    margin: '5px',
  },
  ul: {
    padding: '10px',
    background: 'white',
    borderRadius: '5px',
  },
  li: {
    display: 'inline',
    padding: '10px',
  },
  content: {
    margin: '5px 0px',
    minHeight: '700px',
    background: 'white',
    borderRadius: '5px',
  },
  left: {
    height: '100%',
    minHeight: '700px',
    padding: '20px',
  },
  right: {
    minHeight: '700px',
    backgroundColor: '#E1D7C6',
    padding: '20px',
  },
  postBox: {},
  postHintText: {
    color: '#acdae5',
    marginBottom: '5px',
  },
  postTextArea: {
    resize: 'none' as const,
    boxShadow: 'inset 0 0 1px #aaa',
    border: '1px solid #b9bcbe',
    width: '100%',
    height: '80px',
    fontSize: '14px',
    padding: '5px',
    overflow: 'auto',
  },
  btn: {
    display: 'box',
    textAlign: 'right' as const,
  },
  message: {
    marginTop: '5px',
  },
  msgsUl: {
    padding: '5px',
  },
  msgItem: {
    display: 'block',
    borderBottom: '1px dashed #ddd',
    padding: '15px 0',
  },
  avatar: {
    display: 'block',
    width: '60px',
    height: '60px',
  },
  msgWord: {
    fontSize: '14px',
    display: 'block',
  },
  userName: {
    textDecoration: 'underline',
    marginRight: '5px',
  },
  time: {
    color: 'gray',
    fontSize: '12px',
    marginTop: '5px',
  },
  myAvatar: {
    width: '48px',
    height: '48px',
  },
  smallBtn: {
    fontSize: '12px',
    marginLeft: '5px',
    border: 'none' as const,
  },
  connected: {
    fontSize: '18px',
    fontWeight: '500',
    color: 'green',
  },
  disconnected: {
    fontSize: '18px',
    fontWeight: '500',
    color: 'red',
  },
  userProfile: {
    padding: '10px',
  },
  userProfileAvatar: {
    width: '80px',
    height: '80px',
    marginRight: '10px',
  },
  userProfileName: {
    fontSize: '20px',
    fontWeight: '500',
  },
  userProfileBtnGroup: {
    marginTop: '20px',
  },
};

export type ContactList = Map<
  PublicKey,
  {
    relayer: RelayUrl;
    name: PetName;
  }
>;
export interface KeyPair {
  publicKey: PublicKey;
  privateKey: PrivateKey;
}

interface UserParams {
  eventId: EventId;
}

export const EventPage = ({ isLoggedIn, myPublicKey, myPrivateKey }) => {
  const { t } = useTranslation();
  const { eventId } = useParams<UserParams>();
  const [wsConnectStatus, setWsConnectStatus] = useState<WsConnectStatus>(
    new Map(),
  );
  const [unknownPks, setUnknownPks] = useState<PublicKey[]>([]);
  const [msgList, setMsgList] = useState<Event[]>([]);
  const [userMap, setUserMap] = useState<UserMap>(new Map());
  const [worker, setWorker] = useState<CallWorker>();

  useEffect(() => {
    const worker = new CallWorker(
      (message: FromWorkerMessageData) => {
        if (message.wsConnectStatus) {
          const data = Array.from(message.wsConnectStatus.entries());
          for (const d of data) {
            setWsConnectStatus(prev => {
              const newMap = new Map(prev);
              newMap.set(d[0], d[1]);
              return newMap;
            });
          }
        }
      },
      (message: FromWorkerMessageData) => {
        onMsgHandler(message.nostrData);
      },
    );
    worker.pullWsConnectStatus();
    setWorker(worker);
  }, []);

  function onMsgHandler(data: any) {
    const msg = JSON.parse(data);
    if (isEventSubResponse(msg)) {
      const event = (msg as EventSubResponse)[2];
      switch (event.kind) {
        case WellKnownEventKind.set_metadata:
          const metadata: EventSetMetadataContent = JSON.parse(event.content);
          setUserMap(prev => {
            const newMap = new Map(prev);
            const oldData = newMap.get(event.pubkey);
            if (oldData && oldData.created_at > event.created_at) {
              // the new data is outdated
              return newMap;
            }

            newMap.set(event.pubkey, {
              ...metadata,
              ...{ created_at: event.created_at },
            });
            return newMap;
          });
          break;

        case WellKnownEventKind.text_note:
          {
            setMsgList(oldArray => {
              const replyToEventIds = oldArray
                .map(e => getEventIdsFromETags(e.tags))
                .reduce((prev, current) => prev.concat(current), []);
              if (
                !oldArray.map(e => e.id).includes(event.id) &&
                (replyToEventIds.includes(event.id) || event.id === eventId)
              ) {
                // only add un-duplicated and replyTo msg
                const newItems = [...oldArray, event];
                // sort by timestamp in asc
                const sortedItems = newItems.sort((a, b) =>
                  a.created_at >= b.created_at ? 1 : -1,
                );
                return sortedItems;
              }
              return oldArray;
            });
          }

          // check if need to sub new user metadata
          const newPks: PublicKey[] = [];
          for (const t of event.tags) {
            if (isEventPTag(t)) {
              const pk = t[1];
              if (userMap.get(pk) == null && !unknownPks.includes(pk)) {
                newPks.push(pk);
              }
            }
          }
          if (
            userMap.get(event.pubkey) == null &&
            !unknownPks.includes(event.pubkey)
          ) {
            newPks.push(event.pubkey);
          }
          if (newPks.length > 0) {
            setUnknownPks([...unknownPks, ...newPks]);
          }
          break;

        default:
          break;
      }
    }
  }

  useEffect(() => {
    worker?.subMsgByEventIds([eventId]);
  }, [wsConnectStatus, eventId]);

  useEffect(() => {
    if (unknownPks.length > 0) {
      worker?.subMetadata(unknownPks);
    }
  }, [unknownPks, wsConnectStatus]);

  useEffect(() => {
    const replyToEventIds = msgList
      .map(e => getEventIdsFromETags(e.tags))
      .reduce((prev, current) => prev.concat(current), []);
    const msgIds = msgList.map(m => m.id);

    // subscribe new reply event id
    const newIds: EventId[] = [];
    for (const id of replyToEventIds) {
      if (!msgIds.includes(id)) {
        newIds.push(id);
      }
    }
    if (newIds.length > 0) {
      worker?.subMsgByEventIds(newIds);
    }
  }, [wsConnectStatus, eventId, msgList.length]);

  useEffect(() => {
    const msgIds = msgList.map(e => e.id);
    if (msgIds.length > 0) {
      worker?.subMsgByETags(msgIds);
    }
  }, [msgList.length]);

  const [myKeyPair, setMyKeyPair] = useState<KeyPair>({
    publicKey: myPublicKey,
    privateKey: myPrivateKey,
  });

  useEffect(() => {
    if (isLoggedIn !== true) return;

    setMyKeyPair({
      publicKey: myPublicKey,
      privateKey: myPrivateKey,
    });
  }, [isLoggedIn]);

  const getEventIdsFromETags = (tags: any[]) => {
    const eventIds = tags.filter(t => isEventETag(t)).map(t => t[1] as EventId);
    return eventIds;
  };

  return (
    <div style={styles.root}>
      <NavHeader />

      <div style={styles.content}>
        <Grid container>
          <Grid item xs={8} style={styles.left}>
            <div style={styles.message}>
              <h3>{t('thread.title')}</h3>
              <hr />
              <ul style={styles.msgsUl}>
                {msgList.map((msg, index) => {
                  //@ts-ignore
                  const flycatShareHeaders: FlycatShareHeader[] =
                    msg.tags.filter(t => isFlycatShareHeader(t));
                  if (flycatShareHeaders.length > 0) {
                    const blogPk = getPkFromFlycatShareHeader(
                      flycatShareHeaders[flycatShareHeaders.length - 1],
                    );
                    const cacheHeaders = msg.tags.filter(
                      t => t[0] === CacheIdentifier,
                    );
                    let articleCache = {
                      title: t('thread.noArticleShareTitle'),
                      url: '',
                      blogName: t('thread.noBlogShareName'),
                      blogPicture: '',
                    };
                    if (cacheHeaders.length > 0) {
                      const cache = cacheHeaders[cacheHeaders.length - 1];
                      articleCache = {
                        title: cache[1],
                        url: cache[2],
                        blogName: cache[3],
                        blogPicture: cache[4],
                      };
                    }
                    return (
                      <ShareMsg
                        key={index}
                        content={msg.content}
                        eventId={msg.id}
                        keyPair={myKeyPair}
                        userPk={msg.pubkey}
                        userAvatar={userMap.get(msg.pubkey)?.picture}
                        username={userMap.get(msg.pubkey)?.name}
                        createdAt={msg.created_at}
                        blogName={articleCache.blogName} //todo: fallback to query title
                        blogAvatar={
                          articleCache.blogPicture ||
                          userMap.get(blogPk)?.picture
                        }
                        articleTitle={articleCache.title} //todo: fallback to query title
                      />
                    );
                  } else {
                    return (
                      <TextMsg
                        key={index}
                        pk={msg.pubkey}
                        avatar={userMap.get(msg.pubkey)?.picture}
                        name={userMap.get(msg.pubkey)?.name}
                        content={msg.content}
                        eventId={msg.id}
                        keyPair={myKeyPair}
                        replyTo={msg.tags
                          .filter(t => t[0] === EventTags.P)
                          .map(t => {
                            return {
                              name: userMap.get(t[1])?.name,
                              pk: t[1],
                            };
                          })}
                        createdAt={msg.created_at}
                      />
                    );
                  }
                })}
              </ul>
            </div>
          </Grid>
          <Grid item xs={4} style={styles.right}>
            {isLoggedIn && (
              <UserBox
                pk={myPublicKey}
                avatar={userMap.get(myPublicKey)?.picture}
                name={userMap.get(myPublicKey)?.name}
                about={userMap.get(myPublicKey)?.about}
              />
            )}
            {!isLoggedIn && <UserRequiredLoginBox />}
            <hr />
            <RelayManager />
          </Grid>
        </Grid>
      </div>
    </div>
  );
};

export default connect(mapStateToProps)(EventPage);