import { Component } from "@angular/core";
import { NavController, LoadingController, Platform, AlertController } from "ionic-angular";
import { Pro, DeployInfo, DeployConfig } from "@ionic/pro";
import { HttpClient } from '@angular/common/http';
import { Subject } from "rxjs/Subject";
import { BehaviorSubject } from "rxjs";

const TESTS = [
  'bbcs-4',
  'cms',
  'gfta-2',
  'wiat-iii',
  'wisc-iv'
];

const NORMAL_CHANNEL = 'Production'
const CONTENT_CHANNEL = `Master`

@Component({
  selector: "page-home",
  templateUrl: "home.html"
})
export class HomePage {
  private initialConfig: DeployConfig;
  private tests: string[] = TESTS;
  private processedTests: BehaviorSubject<string[]> = new BehaviorSubject([]);
  constructor(
    public navCtrl: NavController,
    public loadingCtrl: LoadingController,    
    private platform: Platform,
    private http: HttpClient,
    private alertCtrl: AlertController
  ) {
    
  }

  public async downloadAndUpdate() {
    let loading = this.loadingCtrl.create({
      content: "Please wait while we sign you in..."
    });
    loading.present();   
    const stat = await this.fauxLogin();
    loading.dismissAll();
    
    console.log(`Will try to download content`);
    let alert = this.alertCtrl.create({
      title: "Content Update",
      subTitle: "Press ok to start content download",
      buttons: [
        {
          text: 'Ok',
          handler: () => {
            this.downloadContent();
          }
        }
      ]
    });
    alert.present();
  }


  fauxLogin(): Promise<boolean> {
    return new Promise<boolean> ((res) => {
      setTimeout(()=>res(true), 2000);
    });
  }

  async showTests() {
    let procTests = [];
    for(let t of TESTS) {
      try {
        let test = await this.http.get(`assets/battery/${t}/test-json/${t}.json`).toPromise();
        procTests.push(test);
      } catch(e) {
        // ignored
        console.log(`Test ${t} not found`);
      }
    }
    this.processedTests.next(procTests);
  }

  async showTestInfo(test: any) {
    let alert = this.alertCtrl.create({
      title: `Test ${test.displayName}`,
      subTitle: JSON.stringify(test, null, 5),
      buttons: [
        {
          text: 'Ok'
        }
      ]
    });
    alert.present();
  }

  async downloadContent() {
    if(this.platform.is('core')) {
      console.log(`Faux download`);
      return;
    }

    let loading = this.loadingCtrl.create({
      content: "Please wait while check for updates"
    });
    loading.present();   
    await this.checkChannel();
    const initialConfig: DeployConfig =  await Pro.deploy.info();
    this.initialConfig = initialConfig;
    await Pro.deploy.init({
      channel: CONTENT_CHANNEL,
      appId: initialConfig.appId
    });
    await this.performManualUpdate();
    await this.checkChannel();
    await this.logTestJson();
    loading.dismissAll();
  }

  async checkChannel() {
    try {
      const res = await Pro.deploy.info();
      console.log(`check channel ${res.channel}`);
      Pro.monitoring.log(`A new change came in with ${res.binary_version}`, {level: 'info'} );
      Pro.monitoring.log(`check channel ${res.channel}`, {level: 'info'} );
    } catch (err) {
      // We encountered an error.
      // Here's how we would log it to Ionic Pro Monitoring while also catching:

      // Pro.monitoring.exception(err);
    }    
  }

  async performManualUpdate() {

    /*
      Here we are going through each manual step of the update process:
      Check, Download, Extract, and Redirect.
      This code is currently exactly the same as performAutomaticUpdate,
      but you could split it out to customize the flow.

      Ex: Check, Download, Extract when a user logs into your app,
        but Redirect when they logout for an app that is always running
        but used with multiple users (like at a doctors office).
    */

    try {
      const haveUpdate = await Pro.deploy.check();

      if (haveUpdate){
        

        await Pro.deploy.download((progress) => {
          // this.downloadProgress = progress;
        })
        await Pro.deploy.extract();
        await Pro.deploy.redirect();
      }
    } catch (err) {
      // We encountered an error.
      // Here's how we would log it to Ionic Pro Monitoring while also catching:

      // Pro.monitoring.exception(err);
    }

  }

  async logTestJson() {
    for (let test of TESTS) {
      try {
        let json = await this.http.get(`assets/battery/${test}/test-json/${test}.json`).toPromise();
        console.log(` Got JSON for ${test} is ${JSON.stringify(json, null, 5)}`);
        Pro.monitoring.log(`Got JSON for ${test} with ${JSON.stringify(json, null, 5)}`, {level: 'info'} );
      } catch (e) {
        console.log(`didnt get json for ${test}`);
        Pro.monitoring.log(`didnt get json for ${test}`, { level: 'warn'});
      }
    }
  }



}
