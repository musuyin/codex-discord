import { mkdtemp, rm } from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import pino from 'pino';
import {describe,expect,it,vi} from 'vitest';
import {DiscordMessageHandler} from '../src/bot/message-handler.js';
import {TaskOrchestrator} from '../src/core/task-orchestrator.js';
import {ChannelTaskQueue} from '../src/core/channel-task-queue.js';
import {FileSessionStore} from '../src/store/session-store.js';
import {ImageInputError} from '../src/bot/image-attachments.js';
import type {CodexAdapter} from '../src/types/adapter.js';
import type {Message} from 'discord.js';
const channel='123456789012345678';
const binding={guildId:'guild',channelId:channel,projectPath:'/project',sandboxMode:'workspace-write' as const,sandboxModeSource:'default' as const,createdAt:'now',updatedAt:'now'};
const commands={bindCommand:'!bind',bindingCommand:'!binding',unbindCommand:'!unbind',helpCommand:'!help'};
describe('image message to native session pipeline',()=>{
 it.each(['','请识别这些图片'])('preserves image attachments and existing session with prompt %j',async(content)=>{
  const dir=await mkdtemp(path.join(tmpdir(),'discord-image-pipeline-'));
  try{
   const sessionStore=FileSessionStore.fromFile(path.join(dir,'sessions.json'));
   await sessionStore.upsert({channelId:channel,historySummary:'',lastCodexSessionId:'existing-thread'});
   const execute=vi.fn<CodexAdapter['execute']>(async()=>({ok:true,content:'图片识别完成',stderr:'',exitCode:0,durationMs:1,sessionId:'existing-thread'}));
   const logger=pino({level:'silent'});
   const orchestrator=new TaskOrchestrator({codexAdapter:{execute},sessionStore,queue:new ChannelTaskQueue(),logger});
   const download=vi.fn(async()=>['/cache/image-1.png','/cache/image-2.jpg']);
   const handler=new DiscordMessageHandler({bindingStore:{getByChannelId:async()=>binding} as never,orchestrator,commands,logger,imageDownloader:{download}});
   const reply=vi.fn(async()=>{});
   const message={id:'223456789012345678',channelId:channel,guildId:'guild',inGuild:()=>true,author:{bot:false,id:'owner'},content,attachments:new Map([['image',{url:'https://cdn.discordapp.com/attachments/x/image.png',name:'image.png',size:10}]]),reply} as unknown as Message<boolean>;
   await handler.handle(message);
   expect(execute).toHaveBeenCalledWith(expect.objectContaining({imagePaths:['/cache/image-1.png','/cache/image-2.jpg'],session:expect.objectContaining({lastCodexSessionId:'existing-thread'})}));
   expect(execute.mock.calls[0]?.[0].prompt).toBe(content||'请结合我发送的图片和当前对话上下文回答。');
   expect(reply).toHaveBeenCalledTimes(1);expect(reply).toHaveBeenCalledWith('图片识别完成');
  }finally{await rm(dir,{recursive:true,force:true});}
 });
 it('returns a download error without executing Codex',async()=>{
  const submit=vi.fn();const reply=vi.fn(async()=>{});
  const handler=new DiscordMessageHandler({bindingStore:{getByChannelId:async()=>binding} as never,orchestrator:{submit} as never,commands,logger:pino({level:'silent'}),imageDownloader:{download:async()=>{throw new ImageInputError('请重新上传图片');}}});
  await handler.handle({id:'223456789012345678',channelId:channel,inGuild:()=>true,author:{bot:false},content:'',attachments:new Map([['x',{url:'x',name:'x.png',size:1}]]),reply} as unknown as Message<boolean>);
  expect(submit).not.toHaveBeenCalled();expect(reply).toHaveBeenCalledWith('请重新上传图片');
 });
});
